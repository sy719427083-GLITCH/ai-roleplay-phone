import { strict as assert } from "node:assert";
import test from "node:test";
import {
  buildCharacterMomentContext,
  buildMeProfileChatContext,
  buildMomentLikeNames,
  buildMomentRoleReplyComment,
  buildMomentUserComment,
  buildRealTimeContext,
  canSendProactiveMessageNow,
  normalizeProactiveMessageSettings,
  buildRelationshipContext,
  buildWorldbookContext,
  getMomentReplyDelayMs,
  parseRoleTransferReply,
  pickProactiveMessages,
  renderWeChatEmojiText,
  sanitizeOnlineChatText,
} from "./messageLogic.js";

test("proactive fallback can generate up to ten messages", () => {
  const messages = pickProactiveMessages({ name: "林砚舟" }, { random: () => 0.99, minute: 12 });

  assert.equal(messages.length, 10);
  assert.ok(messages.every(Boolean));
});

test("online chat sanitizer preserves emoji and virtual sticker messages", () => {
  const text = sanitizeOnlineChatText("有点无语😂\n【发了一个猫猫无语的表情包】\n[捂脸]");

  assert.match(text, /😂/);
  assert.match(text, /【发了一个猫猫无语的表情包】/);
  assert.match(text, /\[捂脸\]/);
});

test("wechat emoji labels render as emoji in chat text", () => {
  assert.equal(renderWeChatEmojiText("行吧[叹气]\n[捂脸]"), "行吧😮‍💨\n🤦");
  assert.equal(renderWeChatEmojiText("未知[不存在]"), "未知[不存在]");
});

test("real time context exposes current China time for role chat", () => {
  const context = buildRealTimeContext(new Date("2026-07-08T15:30:00+08:00"));

  assert.match(context, /现实时间/);
  assert.match(context, /Asia\/Shanghai/);
  assert.match(context, /2026/);
  assert.match(context, /15:30/);
});

test("proactive settings can block quiet hours and frequency cooldowns", () => {
  const quietDecision = canSendProactiveMessageNow({
    settings: { enabled: true, quietByRealTime: true, frequency: "frequent" },
    lastAt: 0,
    now: new Date("2026-07-08T01:00:00+08:00"),
  });
  assert.equal(quietDecision.allowed, false);
  assert.match(quietDecision.reason, /休息/);

  const cooldownDecision = canSendProactiveMessageNow({
    settings: { enabled: true, quietByRealTime: false, frequency: "medium" },
    lastAt: Date.parse("2026-07-08T12:00:00+08:00"),
    now: new Date("2026-07-08T12:10:00+08:00"),
  });
  assert.equal(cooldownDecision.allowed, false);
  assert.match(cooldownDecision.reason, /中等/);

  const offDecision = canSendProactiveMessageNow({
    settings: { enabled: true, quietByRealTime: false, frequency: "none" },
    lastAt: 0,
    now: new Date("2026-07-08T12:00:00+08:00"),
  });
  assert.equal(offDecision.allowed, false);
  assert.match(offDecision.reason, /关闭/);
});

test("proactive quiet hours use the selected time window", () => {
  const nightDecision = canSendProactiveMessageNow({
    settings: {
      quietByRealTime: true,
      frequency: "frequent",
      quietStart: "21:30",
      quietEnd: "06:15",
    },
    lastAt: 0,
    now: new Date("2026-07-08T22:00:00+08:00"),
  });
  assert.equal(nightDecision.allowed, false);

  const outsideNightDecision = canSendProactiveMessageNow({
    settings: {
      quietByRealTime: true,
      frequency: "frequent",
      quietStart: "21:30",
      quietEnd: "06:15",
    },
    lastAt: 0,
    now: new Date("2026-07-08T12:00:00+08:00"),
  });
  assert.equal(outsideNightDecision.allowed, true);

  const noonDecision = canSendProactiveMessageNow({
    settings: {
      quietByRealTime: true,
      frequency: "frequent",
      quietStart: "12:00",
      quietEnd: "14:00",
    },
    lastAt: 0,
    now: new Date("2026-07-08T13:00:00+08:00"),
  });
  assert.equal(noonDecision.allowed, false);
});

test("legacy disabled proactive settings migrate to frequency none", () => {
  const settings = normalizeProactiveMessageSettings({ enabled: false, frequency: "medium" });

  assert.equal(settings.frequency, "none");
});

test("relationship context describes both directions for the active chat role", () => {
  const context = buildRelationshipContext({
    character: { id: "char-a", name: "林砚舟" },
    characters: [{ id: "char-a", name: "林砚舟" }],
    meProfiles: {
      me_1: { id: "me_1", name: "我" },
    },
    relations: {
      rel_1: {
        charA: "char-a",
        charB: "me_1",
        typeA: "守护者",
        typeB: "被守护者",
        viewA: "会下意识照顾对方，但嘴上不承认。",
        viewB: "信任对方，也会试探边界。",
      },
    },
  });

  assert.match(context, /林砚舟 对 我：守护者/);
  assert.match(context, /我 对 林砚舟：被守护者/);
  assert.match(context, /会下意识照顾对方/);
  assert.match(context, /信任对方/);
});

test("me profile chat context includes the selected user identity and background", () => {
  const context = buildMeProfileChatContext({
    name: "清瑶",
    identity: "流亡公主",
    appearance: "银发蓝眼",
    personality: "谨慎但温柔",
    persona: "自幼离宫，在边境长大。",
  });

  assert.match(context, /聊天对象：清瑶/);
  assert.match(context, /身份：流亡公主/);
  assert.match(context, /外貌：银发蓝眼/);
  assert.match(context, /性格：谨慎但温柔/);
  assert.match(context, /背景：自幼离宫/);
});

test("me profile chat context falls back to user when no profile is selected", () => {
  const context = buildMeProfileChatContext();

  assert.match(context, /聊天对象：我/);
});

test("worldbook context only includes the active character's linked world", () => {
  const context = buildWorldbookContext({
    character: { id: "char-a", name: "林砚舟", worldview: "world-sky" },
    worlds: [
      { id: "world-sky", name: "苍穹纪元", genre: "高魔史诗", tone: "王冠与雪原。" },
      { id: "world-city", name: "雨夜都市", genre: "现代都市", tone: "霓虹与秘密。" },
    ],
    characters: [
      { id: "char-a", name: "林砚舟", worldview: "world-sky", identity: "画师" },
      { id: "char-b", name: "沈清瑶", worldview: "world-sky", identity: "摄政者" },
      { id: "char-c", name: "周晚", worldview: "world-city", identity: "侦探" },
    ],
  });

  assert.match(context, /世界书：苍穹纪元/);
  assert.match(context, /王冠与雪原/);
  assert.match(context, /沈清瑶（摄政者）/);
  assert.doesNotMatch(context, /周晚/);
});

test("moment user comments can target a role reply with black reply wording data", () => {
  const comment = buildMomentUserComment({
    text: "我也想知道后续",
    replyTarget: { author: "林砚舟" },
    now: () => "2026-07-04T12:00:00.000Z",
    idSeed: "second",
  });

  assert.equal(comment.author, "我");
  assert.equal(comment.replyVerb, "回复");
  assert.equal(comment.replyTo, "林砚舟");
  assert.equal(comment.text, "我也想知道后续");
});

test("moment role replies are only appended when API returns text", () => {
  assert.equal(buildMomentRoleReplyComment({ replyText: "", characterName: "林砚舟" }), null);
  assert.equal(buildMomentRoleReplyComment({ replyText: null, characterName: "林砚舟" }), null);

  const comment = buildMomentRoleReplyComment({
    replyText: "我刚好也这么想。",
    characterName: "林砚舟",
    replyTo: "我",
    now: () => "2026-07-04T12:00:01.000Z",
    idSeed: "api",
  });

  assert.equal(comment.author, "林砚舟");
  assert.equal(comment.replyVerb, "回复");
  assert.equal(comment.replyTo, "我");
  assert.equal(comment.text, "我刚好也这么想。");
});

test("role chat moment context only includes the active character's own moments", () => {
  const context = buildCharacterMomentContext({
    characterId: "char-a",
    momentState: {
      items: [
        {
          characterId: "char-a",
          characterName: "林砚舟",
          text: "今天整理旧事。",
          comments: [
            { author: "我", text: "想听" },
            { author: "林砚舟", replyVerb: "回复", replyTo: "我", text: "慢慢说。" },
          ],
        },
        {
          characterId: "char-b",
          characterName: "沈星",
          text: "这是另一个人的动态。",
          comments: [{ author: "我", text: "别让林砚舟知道" }],
        },
      ],
    },
  });

  assert.match(context, /林砚舟发布：今天整理旧事。/);
  assert.match(context, /我：想听/);
  assert.match(context, /林砚舟 回复 我：慢慢说。/);
  assert.doesNotMatch(context, /沈星/);
  assert.doesNotMatch(context, /别让林砚舟知道/);
});

test("moment role reply delay is at least several minutes", () => {
  const delayMs = getMomentReplyDelayMs({ random: () => 0 });

  assert.equal(delayMs, 3 * 60 * 1000);
});

test("moment likes render as names instead of a sentence", () => {
  assert.deepEqual(buildMomentLikeNames({ liked: true }), ["我"]);
  assert.deepEqual(buildMomentLikeNames({ liked: true, likeNames: ["林砚舟", "我"] }), ["我", "林砚舟"]);
  assert.deepEqual(buildMomentLikeNames({ liked: false, likes: ["沈星"] }), ["沈星"]);
});

test("transfer intent without explicit amount still creates a small transfer card", () => {
  const reply = parseRoleTransferReply("再转最后一点碎银，拿去买酒喝");

  assert.equal(reply.text, "再转最后一点碎银，拿去买酒喝");
  assert.equal(reply.transfer.amount, 66);
  assert.equal(reply.transfer.note, "角色转账");
});
