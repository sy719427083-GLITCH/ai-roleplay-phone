import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Bike,
  BookMarked,
  Briefcase,
  BrushCleaning,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ClipboardCheck,
  Database,
  Eye,
  FileText,
  Gamepad2,
  Globe2,
  Heart,
  Image,
  Infinity,
  KeyRound,
  ListPlus,
  Mail,
  MapPin,
  MessageCircle,
  Moon,
  Palette,
  Play,
  Plus,
  Settings,
  ShoppingBag,
  Smartphone,
  Search,
  Sparkles,
  Soup,
  Square,
  ThumbsUp,
  UserRound,
  UsersRound,
  Volume2,
  WalletCards,
} from "lucide-react";
import {
  createEmptyConfig,
  fetchModels,
  normalizeEndpointConfig,
  parseConfigs,
  serializeConfigs,
  STORAGE_KEY,
} from "./apiConfig.js";
import { AVATAR_CROP_OUTPUT_SIZE, getAvatarCropDraw } from "./avatarCrop.js";
import {
  buildCharacterMomentContext,
  buildMomentLikeNames,
  buildMomentRoleReplyComment,
  buildMomentUserComment,
  buildRelationshipContext,
  buildWorldbookContext,
  getMomentReplyDelayMs,
  parseRoleTransferReply,
  pickProactiveMessages,
  sanitizeOnlineChatText,
  splitChatMessages,
} from "./messageLogic.js";
import {
  MESSAGE_STORAGE_KEY,
  acceptFriendRequest,
  appendChatMessage,
  createEmptyMessageState,
  createIncomingFriendRequest,
  createConversationForCharacter,
  deleteConversation,
  markConversationRead,
  normalizeMessageState,
  rejectFriendRequest,
  updateChatMessage,
} from "./messageState.js";

const appGroups = [
  [
    { title: "消息", icon: Mail, variant: "line" },
    { title: "论坛", icon: UsersRound, variant: "line" },
    { title: "小红书", icon: BookMarked, variant: "cutout" },
    { title: "钱包", icon: WalletCards, variant: "line" },
    { title: "游戏", icon: Gamepad2, variant: "line" },
    { title: "美化", icon: Palette, variant: "cutout" },
    { title: "世界书", icon: Globe2, variant: "line" },
    { title: "预设", icon: ListPlus, variant: "line" },
    { title: "外卖", icon: Soup, variant: "line" },
    { title: "外出", icon: MapPin, variant: "line" },
    { title: "日记", icon: BookMarked, variant: "cutout" },
    { title: "经营", icon: Briefcase, variant: "line" },
  ],
  [
    { title: "微博", icon: Eye, variant: "line" },
    { title: "平行世界", icon: Infinity, variant: "line" },
    { title: "购物", icon: ShoppingBag, variant: "line" },
    { title: "工作", icon: Briefcase, variant: "line" },
    { title: "情侣空间", icon: Heart, variant: "solid" },
    { title: "查手机", icon: Smartphone, variant: "line" },
    { title: "日程", icon: CalendarDays, variant: "line" },
  ],
];

const tabs = [
  { id: "home", label: "主页" },
  { id: "characters", label: "角色" },
  { id: "me", label: "我" },
  { id: "settings", label: "设置" },
];

const WORLDBOOK_STORAGE_KEY = "ccat-worldbook-worlds-v1";
const worldbookAsset = (fileName) => `${import.meta.env.BASE_URL}worldbook-assets/${fileName}?v=0.2.22`;

const worldbookCoverMaterials = [
  { id: "aether", name: "高魔", tag: "高魔史诗", image: "cover-aether.png", note: "群星之下，万界由此书写" },
  { id: "fog", name: "雾港", tag: "近代悬疑", image: "cover-fog.png", note: "煤气灯与旧报纸" },
  { id: "orbit", name: "星环", tag: "科幻殖民", image: "cover-orbit.png", note: "轨道、舱门与通讯" },
  { id: "mountain", name: "山海", tag: "东方异闻", image: "cover-mountain.png", note: "群山与古兽传说" },
  { id: "rose", name: "王朝", tag: "宫廷权谋", image: "cover-rose.png", note: "花窗、密约与王座" },
  { id: "campus", name: "校园", tag: "青春日常", image: "cover-campus.png", note: "课桌、操场与旧夏天" },
  { id: "waste", name: "废土", tag: "末日废土", image: "cover-waste.png", note: "风暴、路标与失落城" },
  { id: "city", name: "都市", tag: "现代都市", image: "cover-city.png", note: "高楼、雨夜与秘密" },
  { id: "river", name: "江湖", tag: "武侠江湖", image: "cover-river.png", note: "雨巷、长剑与渡口" },
  { id: "abyss", name: "深海", tag: "深海奇幻", image: "cover-abyss.png", note: "海沟、鲸歌与遗迹" },
  { id: "forest", name: "森林", tag: "森林童话", image: "cover-forest.png", note: "树屋、溪流与秘语" },
  { id: "blank", name: "空白", tag: "自定义", image: "cover-blank.png", note: "为新世界预留第一页" },
];

const worldbookWorlds = [
  {
    id: "sky-era",
    coverId: "aether",
    name: "苍穹纪元",
    genre: "高魔史诗",
    tone: "王冠、雪原与旧画未完",
    updated: "今日 18:40",
    tint: "blue",
    stats: { main: 12, support: 24, links: 18, memories: 96 },
    characters: [
      {
        id: "lin",
        name: "林砚舟",
        identity: "流亡画师",
        relation: "旧友",
        status: "熟识",
        tags: ["温和", "隐忍", "旧王城"],
        summary: "曾为王城壁画师，因一幅未完成的星图被卷入王冠战争。流亡后以替人画像为生，仍保存着关于主角身世的残页。",
        sections: [
          ["背景", "出生于王城东侧的画师街，少年时被选入宫廷工坊。他见过旧王最后一次加冕，也见过城门在雪夜关闭。"],
          ["生平", "王冠战争后，他带着半卷星图离开王城，在北境、赤砂与星坠海之间辗转。每到一处都会留下无名壁画。"],
          ["性格", "说话克制，习惯把危险讲得很轻。真正重要的事情会先画下来，再决定是否说出口。"],
          ["与我的关系", "早年在雨巷相识。他知道我的旧名，却从不主动提起。关系像一封没有拆开的信。"],
          ["重要经历", "参与修复开天裂隙壁画；在雪原救下失踪信使；拒绝帝国议会召回。"],
        ],
      },
      {
        id: "shen",
        name: "沈清瑶",
        identity: "摄政女帝",
        relation: "盟约",
        status: "警惕",
        tags: ["冷静", "王权", "白塔盟约"],
        summary: "以摄政之名维持帝国秩序，真正目标是阻止第二次星坠。她将私人情感藏在每一道政令之后。",
        sections: [
          ["背景", "旧王幼女，白塔学派的前任观星者。登上王座并非野心，而是灾难之后无人可退。"],
          ["生平", "十七岁签署白塔盟约，二十一岁平定西境叛乱，二十四岁开始秘密寻找星坠海遗物。"],
          ["性格", "极度自持，善于计算代价。她相信温柔不能治理帝国，却仍会为无名者留下余地。"],
          ["与我的关系", "表面是契约同盟，私下多次放走我方线人。她既需要我，也防备我。"],
        ],
      },
      {
        id: "qi",
        name: "祁无妄",
        identity: "禁军统领",
        relation: "守护",
        status: "亲近",
        tags: ["沉默", "守誓", "长枪"],
        summary: "掌管王城禁军，奉行古老守誓法。外界以为他效忠王座，其实他守护的是一段被抹去的预言。",
        sections: [
          ["背景", "出身黑曜群山的守誓家族，幼年被送入王城作为质子。"],
          ["生平", "从质子到统领，他每一步都像被写进军令。唯一一次违令，是在王城夜谈后。"],
          ["性格", "话少，行动直接。对承诺近乎固执，宁愿背负罪名也不解释。"],
          ["与我的关系", "曾在雪原护送我三十七日。我们之间的信任来自沉默，而不是誓言。"],
        ],
      },
      {
        id: "bai",
        name: "白棠",
        identity: "星港医生",
        relation: "恩人",
        status: "信赖",
        tags: ["医者", "星港", "旧伤"],
        summary: "在星港经营一间夜诊所，收治不该活下来的人。她保存着许多人的秘密，也保存着我的旧伤记录。",
        sections: [["背景", "前白塔医师，因拒绝交出病人名册被除名。"], ["生平", "星坠海封锁后，她将诊所搬到港口地下三层。"], ["与我的关系", "她知道我每一次濒死的原因。"]],
      },
    ],
    memories: ["初遇雨巷", "旧画未完", "王城夜谈", "雪原离别"],
  },
  {
    id: "fog-port",
    coverId: "fog",
    name: "雾港旧梦",
    genre: "近代悬疑",
    tone: "煤气灯、旧报纸与失踪案",
    updated: "昨日 23:12",
    tint: "mist",
    stats: { main: 8, support: 14, links: 11, memories: 54 },
    characters: [
      {
        id: "yan",
        name: "严渡",
        identity: "私家侦探",
        relation: "委托人",
        status: "试探",
        tags: ["冷幽默", "烟草", "旧案"],
        summary: "雾港最会装作不在乎的人。十年前的港口大火夺走了他的家，也给他留下永远查不完的名单。",
        sections: [["背景", "前警署探员，因公开质疑结案报告被迫离职。"], ["生平", "以私家侦探身份重查雾港旧案，逐渐接近失踪档案的核心。"], ["与我的关系", "他雇我翻译旧报，却从第一天起就在调查我的来历。"]],
      },
      {
        id: "su",
        name: "苏弥",
        identity: "剧院歌者",
        relation: "线索",
        status: "暧昧",
        tags: ["歌声", "假名", "红剧院"],
        summary: "红剧院每晚最后一个谢幕的人。她唱的不是情歌，是某种只有失踪者家属才听得懂的暗号。",
        sections: [["背景", "来自旧码头孤儿院，十二岁进入红剧院。"], ["生平", "她用假名活了七年，每个名字都对应一桩案子。"], ["性格", "明亮、敏锐，擅长把恐惧说成玩笑。"]],
      },
    ],
    memories: ["红剧院雨夜", "码头旧报", "第七封信"],
  },
  {
    id: "star-ring",
    coverId: "orbit",
    name: "星环边境",
    genre: "科幻殖民",
    tone: "冷光舱门、边境协议与失重告别",
    updated: "7月2日",
    tint: "mint",
    stats: { main: 16, support: 25, links: 21, memories: 73 },
    characters: [
      {
        id: "noa",
        name: "诺亚·岑",
        identity: "边境领航员",
        relation: "搭档",
        status: "信任",
        tags: ["领航", "星环", "沉着"],
        summary: "星环边境最年轻的领航员，能在无信标区域凭旧星图返航。他把每一次沉默都当作计算的一部分。",
        sections: [["背景", "出生在殖民舰尾舱，第一次看见行星是在十六岁。"], ["生平", "完成过三次无信标跃迁，失去过两支救援队。"], ["与我的关系", "我们共享同一份航行错误记录。"]],
      },
    ],
    memories: ["失重告别", "第九航道", "蓝色求救信号"],
  },
];

const settingsItems = [
  { id: "api", label: "API设置", icon: KeyRound, featured: true },
  { id: "sound", label: "声音设置", icon: Volume2 },
  { id: "image", label: "画面生图", icon: Image },
  { id: "appearance", label: "外观设置", icon: Palette },
  { id: "time", label: "时间设置", icon: Clock3 },
  { id: "notice", label: "通知开关", icon: Bell },
  { id: "data", label: "数据管理", icon: Database },
  { id: "system", label: "系统设置", icon: Settings },
];

const workCatalog = [
  {
    key: "review",
    icon: "review",
    cn: "审核",
    en: "Review",
    title: "资料审核",
    titleEn: "Document Review",
    content: "核对记录、标注异常、提交摘要",
    contentEn: "Check records, flag issues, submit summary",
    durationMinutes: 265,
    reward: 1280,
    level: 4,
    distance: "0.3 km",
    pin: { x: 50, y: 76 },
  },
  {
    key: "delivery",
    icon: "delivery",
    cn: "配送",
    en: "Delivery",
    title: "社区配送",
    titleEn: "Local Delivery",
    content: "取件、配送、确认签收",
    contentEn: "Pickup, deliver, confirm receipt",
    durationMinutes: 150,
    reward: 360,
    level: 2,
    distance: "2.1 km",
    pin: { x: 12, y: 36 },
  },
  {
    key: "cleaning",
    icon: "cleaning",
    cn: "清洁",
    en: "Cleaning",
    title: "空间清洁",
    titleEn: "Space Cleaning",
    content: "整理房间、清洁地面、归位物品",
    contentEn: "Tidy rooms, clean floors, reset items",
    durationMinutes: 95,
    reward: 220,
    level: 1,
    distance: "1.6 km",
    pin: { x: 22, y: 66 },
  },
  {
    key: "care",
    icon: "care",
    cn: "陪护",
    en: "Care",
    title: "临时陪护",
    titleEn: "Care Support",
    content: "陪同外出、记录状态、完成交接",
    contentEn: "Escort, record status, hand off",
    durationMinutes: 380,
    reward: 1620,
    level: 4,
    distance: "1.9 km",
    pin: { x: 79, y: 67 },
  },
  {
    key: "night",
    icon: "night",
    cn: "夜班",
    en: "Night",
    title: "夜间巡检",
    titleEn: "Night Check",
    content: "巡查路线、处理异常、填写报告",
    contentEn: "Patrol route, handle issues, file report",
    durationMinutes: 540,
    reward: 2480,
    level: 5,
    distance: "2.7 km",
    pin: { x: 88, y: 39 },
  },
  {
    key: "kitchen",
    icon: "kitchen",
    cn: "备餐",
    en: "Prep",
    title: "餐食备料",
    titleEn: "Meal Prep",
    content: "清点食材、切配备料、完成封存",
    contentEn: "Check ingredients, prep, seal packs",
    durationMinutes: 80,
    reward: 260,
    level: 1,
    distance: "0.8 km",
    pin: { x: 34, y: 32 },
  },
  {
    key: "shop",
    icon: "shop",
    cn: "代购",
    en: "Shop",
    title: "清单代购",
    titleEn: "List Shopping",
    content: "核对清单、采购物品、整理票据",
    contentEn: "Check list, buy items, file receipt",
    durationMinutes: 120,
    reward: 420,
    level: 2,
    distance: "1.2 km",
    pin: { x: 66, y: 34 },
  },
  {
    key: "device",
    icon: "device",
    cn: "检修",
    en: "Device",
    title: "设备检修",
    titleEn: "Device Check",
    content: "检查设备、记录故障、提交照片",
    contentEn: "Inspect device, log issues, submit photos",
    durationMinutes: 210,
    reward: 780,
    level: 3,
    distance: "2.4 km",
    pin: { x: 18, y: 53 },
  },
  {
    key: "event",
    icon: "event",
    cn: "活动",
    en: "Event",
    title: "活动协助",
    titleEn: "Event Assist",
    content: "布置物料、维持秩序、清点回收",
    contentEn: "Set materials, guide flow, count returns",
    durationMinutes: 300,
    reward: 1380,
    level: 4,
    distance: "2.8 km",
    pin: { x: 76, y: 53 },
  },
  {
    key: "beauty",
    icon: "beauty",
    cn: "美化",
    en: "Style",
    title: "空间美化",
    titleEn: "Space Styling",
    content: "调整陈列、拍摄样图、同步清单",
    contentEn: "Style display, shoot samples, sync list",
    durationMinutes: 180,
    reward: 620,
    level: 2,
    distance: "1.7 km",
    pin: { x: 62, y: 73 },
  },
  {
    key: "game",
    icon: "game",
    cn: "陪玩",
    en: "Game",
    title: "游戏陪练",
    titleEn: "Game Coach",
    content: "组队练习、复盘操作、提交总结",
    contentEn: "Team practice, review moves, summarize",
    durationMinutes: 240,
    reward: 920,
    level: 3,
    distance: "0.6 km",
    pin: { x: 42, y: 58 },
  },
  {
    key: "survey",
    icon: "survey",
    cn: "调研",
    en: "Survey",
    title: "街区调研",
    titleEn: "Area Survey",
    content: "采集点位、记录人流、上传表格",
    contentEn: "Collect spots, log flow, upload sheet",
    durationMinutes: 360,
    reward: 2150,
    level: 5,
    distance: "3.1 km",
    pin: { x: 86, y: 62 },
  },
];

const levelMarks = ["I", "II", "III", "IV", "V"];

const workIconMap = {
  review: ClipboardCheck,
  delivery: Bike,
  cleaning: BrushCleaning,
  care: UserRound,
  night: Moon,
  writing: FileText,
  assistant: Briefcase,
  errand: MapPin,
  kitchen: Soup,
  shop: ShoppingBag,
  device: Smartphone,
  event: CalendarDays,
  beauty: Palette,
  game: Gamepad2,
  survey: Globe2,
};

const workPins = [
  { x: 50, y: 76 },
  { x: 12, y: 36 },
  { x: 22, y: 66 },
  { x: 79, y: 67 },
  { x: 88, y: 39 },
  { x: 34, y: 32 },
  { x: 66, y: 34 },
  { x: 18, y: 53 },
  { x: 76, y: 53 },
  { x: 62, y: 73 },
];

const WORK_JOBS_STORAGE_KEY = "ccatWorkJobs";
const WORK_ACTIVE_STORAGE_KEY = "ccatActiveWork";
const WORK_SELECTED_STORAGE_KEY = "ccatSelectedWork";
const WORK_PAID_REFRESH_COST = 20;
const highValueWorkKeys = new Set(["review", "night", "device", "event", "survey"]);

const roundToStep = (value, step = 5) => Math.max(step, Math.round(value / step) * step);

const chooseWorkCompensation = (durationMinutes, level = 1, highValue = false) => {
  const safeLevel = Math.min(5, Math.max(1, Number(level) || 1));
  let minutes = Math.min(600, Math.max(30, Number(durationMinutes) || 60));
  let hourlyRate;

  if (highValue) {
    minutes = Math.min(600, Math.max(minutes, 420 + Math.round((Math.random() * 180) / 5) * 5));
    hourlyRate = Math.random() < 0.5
      ? roundToStep(108 + Math.random() * (38 + safeLevel * 10), 5)
      : roundToStep(82 + Math.random() * (10 + safeLevel * 3), 5);
    if (hourlyRate * (minutes / 60) < 1000) {
      hourlyRate = roundToStep(1000 / (minutes / 60), 5);
    }
  } else {
    hourlyRate = roundToStep(24 + Math.random() * (24 + safeLevel * 7), 5);
  }

  return {
    durationMinutes: minutes,
    hourlyRate,
    reward: Math.min(9999, roundToStep(hourlyRate * (minutes / 60), highValue ? 10 : 5)),
  };
};

const reconcileWorkCompensation = (item = {}, fallback = workCatalog[0]) => {
  const durationMinutes = Math.min(600, Math.max(30, Number(item.durationMinutes || item.duration || fallback.durationMinutes)));
  const level = Math.min(5, Math.max(1, Number(item.level || fallback.level)));
  const hourlyRate = Number(item.hourlyRate || item.hourly || item.rate);

  if (hourlyRate > 0) {
    return {
      durationMinutes,
      hourlyRate: Math.min(999, hourlyRate),
      reward: Math.min(9999, roundToStep(hourlyRate * (durationMinutes / 60), Number(item.reward) >= 1000 ? 10 : 5)),
    };
  }

  const suppliedReward = Number(item.reward || fallback.reward);
  if (suppliedReward > 0) {
    return {
      durationMinutes,
      hourlyRate: Math.max(1, Math.round(suppliedReward / Math.max(0.5, durationMinutes / 60))),
      reward: Math.min(9999, Math.max(1, Math.round(suppliedReward))),
    };
  }

  return chooseWorkCompensation(durationMinutes, level, false);
};

const inferWorkIcon = (item = {}, index = 0, usedIcons = new Set()) => {
  const source = `${item.icon || ""} ${item.type || ""} ${item.cn || ""} ${item.en || ""} ${item.title || ""} ${item.content || ""}`.toLowerCase();
  const candidates = [
    [/配送|送|delivery|courier|errand|跑腿|外勤/, "delivery"],
    [/清洁|clean|整理|保洁/, "cleaning"],
    [/陪护|照看|care|护理|陪伴/, "care"],
    [/夜|night|巡检|值守/, "night"],
    [/写|文案|writing|稿|记录/, "writing"],
    [/助理|assistant|事务|排程/, "assistant"],
    [/备餐|餐|kitchen|meal|prep|食材/, "kitchen"],
    [/代购|shop|采购|清单|票据/, "shop"],
    [/检修|device|设备|手机|故障/, "device"],
    [/活动|event|布置|秩序/, "event"],
    [/美化|style|陈列|拍摄|设计/, "beauty"],
    [/游戏|game|陪练|复盘/, "game"],
    [/调研|survey|采集|人流|街区/, "survey"],
    [/审核|资料|review|document|核对|标注/, "review"],
  ];
  const matched = candidates.find(([pattern]) => pattern.test(source))?.[1];
  const fallback = workCatalog[index]?.icon || workCatalog[index]?.key || "review";
  const preferred = matched || (workIconMap[item.icon] ? item.icon : fallback);
  if (!usedIcons.has(preferred)) {
    usedIcons.add(preferred);
    return preferred;
  }
  const openIcon = Object.keys(workIconMap).find((icon) => !usedIcons.has(icon)) || preferred;
  usedIcons.add(openIcon);
  return openIcon;
};

const formatWorkTime = (milliseconds) => {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return [hours, minutes].map((part) => String(part).padStart(2, "0")).join(":");
};

const buildWorkJobs = () => {
  const regularPool = [...workCatalog].sort(() => Math.random() - 0.5);
  const premiumPool = workCatalog.filter((job) => highValueWorkKeys.has(job.key)).sort(() => Math.random() - 0.5);
  const usedKeys = new Set();

  return Array.from({ length: 5 }).map((_, index) => {
    const highValue = Math.random() < 0.1;
    const pool = highValue ? premiumPool : regularPool;
    const job = pool.find((item) => !usedKeys.has(item.key)) || regularPool.find((item) => !usedKeys.has(item.key)) || workCatalog[index];
    usedKeys.add(job.key);
    const levelOffset = Math.max(0, job.level - 1);
    const durationJitter = Math.round((Math.random() * 34 - 12) / 5) * 5;
    const baseDuration = Math.min(600, Math.max(45, job.durationMinutes + durationJitter + levelOffset * 8));
    const compensation = chooseWorkCompensation(baseDuration, job.level, highValue);

    return {
      ...job,
      key: `${job.key}_${Date.now()}_${index}`,
      durationMinutes: compensation.durationMinutes,
      hourlyRate: compensation.hourlyRate,
      reward: compensation.reward,
      pin: workPins[index] || job.pin,
    };
  });
};

const normalizeWorkJobs = (items = []) => {
  if (!Array.isArray(items)) return [];
  const usedIcons = new Set();
  return items.slice(0, 5).map((item, index) => {
    const fallback = workCatalog[index] || workCatalog[0];
    const level = Math.min(5, Math.max(1, Number(item.level || fallback.level)));
    const compensation = reconcileWorkCompensation(item, fallback);
    return {
      ...fallback,
      key: `${fallback.key}_${Date.now()}_${index}`,
      icon: inferWorkIcon(item, index, usedIcons),
      cn: String(item.cn || item.label || fallback.cn).slice(0, 4),
      en: String(item.en || item.labelEn || fallback.en).slice(0, 14),
      title: String(item.title || fallback.title).slice(0, 12),
      titleEn: String(item.titleEn || item.englishTitle || fallback.titleEn).slice(0, 28),
      content: String(item.content || fallback.content).slice(0, 36),
      contentEn: String(item.contentEn || item.englishContent || fallback.contentEn).slice(0, 72),
      durationMinutes: compensation.durationMinutes,
      hourlyRate: compensation.hourlyRate,
      reward: compensation.reward,
      level,
      distance: String(item.distance || fallback.distance),
      pin: workPins[index] || fallback.pin,
    };
  });
};

const loadStoredWorkJobs = () => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(WORK_JOBS_STORAGE_KEY));
    if (Array.isArray(stored) && stored.length) {
      return stored.slice(0, 5).map((job, index) => {
        const fallback = workCatalog[index] || workCatalog[0];
        const compensation = reconcileWorkCompensation(job, fallback);
        return {
          ...fallback,
          ...job,
          key: job.key || `${fallback.key}_${Date.now()}_${index}`,
          durationMinutes: compensation.durationMinutes,
          hourlyRate: compensation.hourlyRate,
          reward: compensation.reward,
          pin: job.pin || workPins[index] || fallback.pin,
        };
      });
    }
  } catch {
    // Fall back to local generation when stored work data is unavailable.
  }
  return buildWorkJobs();
};

const loadStoredActiveWork = () => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(WORK_ACTIVE_STORAGE_KEY));
    if (stored?.jobKey && stored?.startAt && stored?.endAt) return stored;
  } catch {
    // Ignore broken persisted work state.
  }
  return null;
};

const readWalletData = () => {
  let current = { balance: 0, transactions: [] };
  try {
    const stored = window.localStorage.getItem(WALLET_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      current = {
        balance: Number(parsed.balance) || 0,
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      };
    }
  } catch {
    current = { balance: 0, transactions: [] };
  }
  return current;
};

const writeWalletData = (walletData) => {
  window.localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(walletData));
};

const formatWalletDate = () => {
  const now = new Date();
  return `${now.getMonth() + 1}-${now.getDate()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};

const applyWalletTransaction = ({ type, amount, desc }) => {
  const value = Number(amount) || 0;
  if (value <= 0) return false;
  const current = readWalletData();
  if (type === "sub" && current.balance < value) return false;
  writeWalletData({
    balance: current.balance + (type === "add" ? value : -value),
    transactions: [
      {
        id: Date.now(),
        type,
        amount: value,
        desc,
        date: formatWalletDate(),
      },
      ...current.transactions,
    ],
  });
  return true;
};

const creditWalletFromWork = (job, amount) => {
  applyWalletTransaction({ type: "add", amount, desc: `工作结算 - ${job.title}` });
};

const spendWalletForWorkRefresh = () => {
  return applyWalletTransaction({ type: "sub", amount: WORK_PAID_REFRESH_COST, desc: "工作刷新" });
};

const formatDate = (date) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);

const formatTime = (date) =>
  new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

function LockScreen({ onUnlock }) {
  const [now, setNow] = useState(new Date());
  const [startY, setStartY] = useState(null);
  const [pull, setPull] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000 * 20);
    return () => window.clearInterval(timer);
  }, []);

  const begin = (event) => setStartY(event.clientY ?? event.touches?.[0]?.clientY ?? 0);
  const move = (event) => {
    if (startY === null) return;
    const current = event.clientY ?? event.touches?.[0]?.clientY ?? startY;
    setPull(Math.min(120, Math.max(0, startY - current)));
  };
  const end = () => {
    if (pull > 68) onUnlock();
    setStartY(null);
    setPull(0);
  };

  return (
    <section
      className="lock-screen"
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      style={{ "--lift": `${pull * -0.35}px` }}
    >
      <div className="lock-time" style={{ transform: `translateY(var(--lift))` }}>
        <p>{formatDate(now)}</p>
        <h1>{formatTime(now)}</h1>
      </div>
      <button className="unlock-handle" onClick={onUnlock} aria-label="上划解锁">
        <span></span>
        <em>tap or swipe to unlock</em>
      </button>
    </section>
  );
}

function AppIcon({ item, onOpen, badge = 0 }) {
  const Icon = item.icon;
  const isSolid = item.variant === "solid";
  const isCutout = item.variant === "cutout";
  const open = (event) => {
    const rect = event.currentTarget.querySelector(".app-icon").getBoundingClientRect();
    onOpen({
      title: item.title,
      originX: rect.left + rect.width / 2,
      originY: rect.top + rect.height / 2,
    });
  };

  return (
    <button className="app-icon-button" onClick={open}>
      <span className="app-icon">
        <Icon
          size={28}
          strokeWidth={isCutout ? 0.9 : isSolid ? 1.05 : 1.45}
          stroke={isCutout ? "#ffffff" : "currentColor"}
          fill={isSolid || isCutout ? "currentColor" : "none"}
          fillOpacity={isSolid || isCutout ? 0.9 : 0}
        />
        {badge > 0 && <em className="app-badge">+{Math.min(99, badge)}</em>}
      </span>
      <span>{item.title}</span>
    </button>
  );
}

function HomeScreen({ onOpen, messageUnread = 0 }) {
  const [page, setPage] = useState(0);
  const [startX, setStartX] = useState(null);
  const [dragX, setDragX] = useState(0);
  const didDragRef = useRef(false);

  const begin = (event) => {
    didDragRef.current = false;
    setStartX(event.clientX ?? event.touches?.[0]?.clientX ?? 0);
  };
  const move = (event) => {
    if (startX === null) return;
    const current = event.clientX ?? event.touches?.[0]?.clientX ?? startX;
    const rawDelta = current - startX;
    if (Math.abs(rawDelta) > 8) didDragRef.current = true;
    const atFirstPage = page === 0 && rawDelta > 0;
    const atLastPage = page === appGroups.length - 1 && rawDelta < 0;
    const resistedDelta = atFirstPage || atLastPage ? rawDelta * 0.28 : rawDelta;
    setDragX(Math.max(-window.innerWidth, Math.min(window.innerWidth, resistedDelta)));
  };
  const end = () => {
    const threshold = Math.min(92, window.innerWidth * 0.22);
    if (dragX < -threshold && page < appGroups.length - 1) setPage(page + 1);
    if (dragX > threshold && page > 0) setPage(page - 1);
    setStartX(null);
    setDragX(0);
    window.setTimeout(() => {
      didDragRef.current = false;
    }, 160);
  };
  const isDragging = startX !== null;
  const openApp = (app) => {
    if (didDragRef.current) return;
    onOpen(app);
  };

  return (
    <section
      className="screen-view home-view"
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="top-line">
        <span>CCAT OS</span>
      </div>
      <div className="app-carousel">
        <div
          className="app-pages"
          style={{
            transform: `translate3d(calc(${-page * 100}% + ${dragX}px), 0, 0)`,
            transition: isDragging ? "none" : undefined,
          }}
        >
          {appGroups.map((group, index) => (
            <div className="app-grid" key={index}>
              {group.map((item) => (
                <AppIcon item={item} key={item.title} onOpen={openApp} badge={item.title === "消息" ? messageUnread : 0} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="pager">
        {appGroups.map((_, index) => (
          <button
            className={index === page ? "active" : ""}
            key={index}
            onClick={() => setPage(index)}
            aria-label={`第 ${index + 1} 页`}
          />
        ))}
      </div>
    </section>
  );
}

function QuietPanel({ title, icon: Icon }) {
  return (
    <section className="screen-view centered-view">
      <div className="large-glass-icon">
        <Icon size={32} strokeWidth={1.5} />
      </div>
      <h2>{title}</h2>
    </section>
  );
}

const CHARACTER_STORAGE_KEY = "apiCharacters";
const LEGACY_CHARACTER_STORAGE_KEY = "ccat-character-profile";
const RELATION_STORAGE_KEY = "apiRelations";
const ME_PROFILE_STORAGE_KEY = "apiMeProfiles";
const USER_CHARACTER_ID = "__USER__";
const WALLET_STORAGE_KEY = "roleplayWallet";
const PROACTIVE_MESSAGE_STORAGE_KEY = "ccatLastProactiveMessageAt";
const MOMENTS_STORAGE_KEY = "ccatMessageMoments";
const PROACTIVE_MESSAGE_COOLDOWN_MS = 8 * 60 * 1000;
const PROACTIVE_MESSAGE_CHECK_MS = 2 * 60 * 1000;

const normalizeWorldbookWorld = (world = {}) => ({
  id: String(world.id || world.name || `world-${Date.now()}`),
  coverId: world.coverId || worldbookCoverMaterials[0].id,
  name: world.name || "未命名世界",
  genre: world.genre || "自定义",
  tone: world.tone || world.note || "",
  updated: world.updated || "刚刚",
  tint: world.tint || "custom",
  stats: world.stats || {},
  characters: Array.isArray(world.characters) ? world.characters : [],
  memories: Array.isArray(world.memories) ? world.memories : [],
  custom: Boolean(world.custom),
});

const readStoredWorldbookWorlds = () => {
  try {
    const stored = window.localStorage.getItem(WORLDBOOK_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeWorldbookWorld) : [];
  } catch {
    return [];
  }
};

const readWorldbookWorldsForSelect = () => readStoredWorldbookWorlds();

const readWorldbookCharacterList = () => {
  try {
    const stored = window.localStorage.getItem(CHARACTER_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    return Object.entries(parsed)
      .map(([id, character]) => ({
        id,
        ...character,
        name: character?.name || "未命名角色",
        identity: character?.identity || character?.role || "角色",
        relation: character?.relation || "已同步",
        status: character?.status || "角色 APP",
        sections: [
          ["背景", character?.persona || "角色 APP 暂未填写详细背景。"],
          ["生平", character?.life || character?.persona || "等待继续补充人物生平。"],
          ["性格", character?.personality || "角色 APP 暂未填写性格。"],
          ["外貌", character?.appearance || "角色 APP 暂未填写外貌。"],
        ],
        tags: [character?.identity, character?.worldview].filter(Boolean).slice(0, 3),
        summary: character?.persona || character?.personality || "从角色 APP 同步的人物档案。",
        syncedFromCharacterApp: true,
      }))
      .filter((character) => character.id);
  } catch {
    return [];
  }
};

const getCharacterWorldKey = (character = {}) => String(character.worldbookId || character.worldId || character.worldview || "").trim();

const characterBelongsToWorld = (character, world) => {
  const key = getCharacterWorldKey(character);
  if (!key || !world) return false;
  return key === world.id || key === world.name || key === world.genre;
};

const mergeWorldCharacters = (world, syncedCharacters) => {
  const normalized = normalizeWorldbookWorld(world);
  const synced = syncedCharacters.filter((character) => characterBelongsToWorld(character, normalized));
  const existingIds = new Set(synced.map((character) => character.id));
  const builtIn = normalized.characters.filter((character) => !existingIds.has(character.id));
  const characters = [...synced, ...builtIn];
  return {
    ...normalized,
    characters,
    stats: {
      ...normalized.stats,
      main: synced.length || normalized.stats?.main || characters.length,
      support: normalized.stats?.support || 0,
      links: normalized.stats?.links || Math.max(0, characters.length - 1),
    },
  };
};

const CHROME_COLORS = {
  home: "#f7f7f9",
  white: "#ffffff",
  me: "#fdfbf8",
  lock: "#fbfbfb",
  worldbook: "#dff1ff",
};

const setChromeColor = (color) => {
  if (typeof document === "undefined") return;
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", color);
  const chromeMode =
    color === CHROME_COLORS.white
      ? "white"
      : color === CHROME_COLORS.me
        ? "me"
        : color === CHROME_COLORS.worldbook
          ? "worldbook"
          : "default";
  document.documentElement.dataset.chromeColor = chromeMode;
  document.body.dataset.chromeColor = chromeMode;
  document.documentElement.style.backgroundColor = color;
  document.body.style.backgroundColor = color;
  const root = document.getElementById("root");
  if (root) root.style.backgroundColor = color;
};

const resetViewportScroll = () => {
  if (typeof window === "undefined") return;
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
};

const getChromeColor = ({ locked, tab, openedApp, settingPage, launching }) => {
  const launchTitle = launching?.type === "app" ? launching.payload?.title : "";
  if (locked) return CHROME_COLORS.lock;
  if (openedApp?.title === "消息" || launchTitle === "消息") return CHROME_COLORS.white;
  if (openedApp?.title === "世界书" || launchTitle === "世界书") return CHROME_COLORS.worldbook;
  if (settingPage || launching?.type === "setting") return CHROME_COLORS.home;
  if (tab === "me") return CHROME_COLORS.me;
  return CHROME_COLORS.home;
};

const relationTypes = ["挚友", "宿敌", "恋人", "师徒", "主仆", "血亲", "暗恋", "盟友", "死敌", "单相思", "合作", "救赎", "custom"];

const createEmptyCharacter = (type = "main") => ({
  id: "",
  type,
  avatar: "",
  name: "",
  identity: "",
  worldview: "",
  appearance: "",
  personality: "",
  persona: "",
});

const createEmptyRelation = () => ({
  charA: "",
  charB: "",
  type: "挚友",
  typeA: "挚友",
  typeB: "挚友",
  customType: "",
  customTypeA: "",
  customTypeB: "",
  viewA: "",
  viewB: "",
});

const createEmptyMeProfile = () => ({
  id: "",
  type: "user",
  avatar: "",
  name: "",
  identity: "",
  appearance: "",
  personality: "",
  persona: "",
});

const readAvatarFile = (file, onAvatar, size = 200) => {
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result || "");
    if (!dataUrl) return;
    onAvatar(dataUrl);

    const image = new window.Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return;
      const min = Math.min(image.width, image.height);
      const sx = (image.width - min) / 2;
      const sy = (image.height - min) / 2;
      canvas.width = size;
      canvas.height = size;
      context.drawImage(image, sx, sy, min, min, 0, 0, size, size);
      onAvatar(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => onAvatar(dataUrl);
    image.src = dataUrl;
  };
  reader.readAsDataURL(file);
};

const readAvatarSource = (file, onLoad) => {
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result || "");
    if (dataUrl) onLoad(dataUrl);
  };
  reader.readAsDataURL(file);
};

const getStoredMessageState = () => {
  try {
    const stored = window.localStorage.getItem(MESSAGE_STORAGE_KEY);
    return stored ? normalizeMessageState(JSON.parse(stored)) : createEmptyMessageState();
  } catch {
    return createEmptyMessageState();
  }
};

const writeStoredMessageState = (state) => {
  window.localStorage.setItem(MESSAGE_STORAGE_KEY, JSON.stringify(normalizeMessageState(state)));
};

const getMessageUnreadCount = (state = getStoredMessageState()) =>
  normalizeMessageState(state).conversations.reduce((sum, conversation) => sum + Math.max(0, Number(conversation.unread) || 0), 0);

const waitForChatBeat = (index = 0) =>
  new Promise((resolve) => window.setTimeout(resolve, 620 + index * 220));

const formatChatClock = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "刚刚";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

function AvatarContent({ character }) {
  if (character?.avatar) return <img src={character.avatar} alt={character.name || "角色头像"} />;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4Zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4Z" />
    </svg>
  );
}

function AvatarCropModal({ source, onCancel, onConfirm }) {
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef(null);
  const outputSize = AVATAR_CROP_OUTPUT_SIZE;
  const previewSize = 238;
  const previewDraw = getAvatarCropDraw({
    imageWidth: imageSize.width,
    imageHeight: imageSize.height,
    outputSize: previewSize,
    zoom,
    offsetX: offset.x,
    offsetY: offset.y,
  });

  useEffect(() => {
    setOffset({ x: 0, y: 0 });
    setZoom(1);
  }, [source]);

  const handlePointerDown = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    setOffset({
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    });
  };

  const stopDrag = () => {
    dragRef.current = null;
  };

  const confirmCrop = () => {
    const image = new window.Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return;
      canvas.width = outputSize;
      canvas.height = outputSize;
      const scale = outputSize / previewSize;
      const draw = getAvatarCropDraw({
        imageWidth: image.width,
        imageHeight: image.height,
        outputSize,
        zoom,
        offsetX: offset.x * scale,
        offsetY: offset.y * scale,
      });
      context.drawImage(image, draw.dx, draw.dy, draw.dWidth, draw.dHeight);
      onConfirm(canvas.toDataURL("image/jpeg", 0.94));
    };
    image.onerror = () => onConfirm(source);
    image.src = source;
  };

  return (
    <div className="avatar-crop-backdrop">
      <div className="avatar-crop-panel" role="dialog" aria-modal="true" aria-label="头像裁剪">
        <div className="avatar-crop-title">
          <strong>调整头像</strong>
          <span>Drag & Zoom</span>
        </div>
        <div
          className="avatar-crop-stage"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
        >
          <div className="avatar-crop-frame">
            <img
              src={source}
              alt="头像裁剪预览"
              draggable="false"
              onLoad={(event) => {
                setImageSize({
                  width: event.currentTarget.naturalWidth || 1,
                  height: event.currentTarget.naturalHeight || 1,
                });
              }}
              style={{
                width: `${previewDraw.dWidth}px`,
                height: `${previewDraw.dHeight}px`,
                transform: `translate(${previewDraw.dx}px, ${previewDraw.dy}px)`,
              }}
            />
          </div>
          <span className="avatar-crop-ring" aria-hidden="true"></span>
        </div>
        <label className="avatar-crop-slider">
          <span>缩放</span>
          <input
            type="range"
            min="1"
            max="2.8"
            step="0.01"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
        <div className="avatar-crop-actions">
          <button onClick={onCancel}>取消</button>
          <button onClick={confirmCrop}>使用头像</button>
        </div>
      </div>
    </div>
  );
}

function CharacterAppScreen({ onChildPageChange }) {
  const [characters, setCharacters] = useState(() => {
    try {
      const stored = window.localStorage.getItem(CHARACTER_STORAGE_KEY);
      if (stored) return JSON.parse(stored) || {};
      const legacy = window.localStorage.getItem(LEGACY_CHARACTER_STORAGE_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (parsed?.name || parsed?.identity || parsed?.persona || parsed?.avatar) {
          return {
            char_legacy: {
              ...createEmptyCharacter(parsed.type === "NPC" ? "npc" : "main"),
              ...parsed,
              id: "char_legacy",
              type: parsed.type === "NPC" ? "npc" : "main",
            },
          };
        }
      }
    } catch {
      return {};
    }
    return {};
  });
  const [meProfiles, setMeProfiles] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem(ME_PROFILE_STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  });
  const [relations, setRelations] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem(RELATION_STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  });
  const [subTab, setSubTab] = useState("main");
  const [previewId, setPreviewId] = useState(null);
  const [previewType, setPreviewType] = useState("main");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingType, setEditingType] = useState("main");
  const [draft, setDraft] = useState(createEmptyCharacter("main"));
  const [relationEditorOpen, setRelationEditorOpen] = useState(false);
  const [editingRelationId, setEditingRelationId] = useState(null);
  const [relationDraft, setRelationDraft] = useState(createEmptyRelation());
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorTarget, setSelectorTarget] = useState("charA");
  const [selectorSearch, setSelectorSearch] = useState("");
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptValue, setPromptValue] = useState("");
  const [generating, setGenerating] = useState(false);
  const [cropSource, setCropSource] = useState("");
  const [worldbookOptions, setWorldbookOptions] = useState(readWorldbookWorldsForSelect);

  useEffect(() => {
    onChildPageChange?.(Boolean(previewId || editorOpen));
    return () => onChildPageChange?.(false);
  }, [previewId, editorOpen, onChildPageChange]);

  useEffect(() => {
    window.localStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(characters));
  }, [characters]);

  useEffect(() => {
    const refreshWorldbooks = () => setWorldbookOptions(readWorldbookWorldsForSelect());
    refreshWorldbooks();
    window.addEventListener("storage", refreshWorldbooks);
    window.addEventListener("focus", refreshWorldbooks);
    return () => {
      window.removeEventListener("storage", refreshWorldbooks);
      window.removeEventListener("focus", refreshWorldbooks);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(RELATION_STORAGE_KEY, JSON.stringify(relations));
  }, [relations]);

  useEffect(() => {
    const syncMeProfiles = () => {
      try {
        setMeProfiles(JSON.parse(window.localStorage.getItem(ME_PROFILE_STORAGE_KEY)) || {});
      } catch {
        setMeProfiles({});
      }
    };
    syncMeProfiles();
    window.addEventListener("storage", syncMeProfiles);
    return () => window.removeEventListener("storage", syncMeProfiles);
  }, []);

  const patchDraft = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const patchRelationDraft = (patch) => setRelationDraft((current) => ({ ...current, ...patch }));
  const getWorldbookLabel = (worldKey) => {
    const world = worldbookOptions.find((item) => item.id === worldKey || item.name === worldKey);
    return world?.name || worldKey || "UNKNOWN WORLD";
  };

  const getCharacterData = (id) => {
    if (meProfiles[id]) {
      const profile = meProfiles[id];
      return {
        ...profile,
        id,
        type: "user",
        name: profile.name || "未命名",
        identity: profile.identity || "主角身份",
      };
    }
    if (id === USER_CHARACTER_ID) {
      return {
        id,
        type: "user",
        avatar: "",
        name: "我 (USER)",
        identity: "主角本人",
      };
    }
    if (characters[id]) {
      const character = characters[id];
      return {
        ...character,
        id,
        name: character.name || "未命名",
        identity: character.identity || "Unknown Identity",
      };
    }
    return {
      id,
      type: "deleted",
      avatar: "",
      name: "已删除",
      identity: "档案不存在",
    };
  };

  const getRelationLabel = (relation, direction = "") => {
    const typeKey = direction === "A" ? "typeA" : direction === "B" ? "typeB" : "type";
    const customKey = direction === "A" ? "customTypeA" : direction === "B" ? "customTypeB" : "customType";
    const type = relation[typeKey] || relation.type || "挚友";
    if (type !== "custom") return type;
    return relation[customKey]?.trim() || relation.customType?.trim() || "自定义";
  };

  const openCharacterPreview = (id, type = "main") => {
    setPreviewId(id);
    setPreviewType(type);
  };

  const closeCharacterPreview = () => {
    setPreviewId(null);
  };

  const previewCharacter = previewId ? characters[previewId] : null;

  const openEditor = (id, type = "main") => {
    setEditorOpen(true);
    setEditingId(id);
    setEditingType(type);
    setDraft(id && characters[id] ? { ...createEmptyCharacter(type), ...characters[id], id } : createEmptyCharacter(type));
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingId(null);
    setDraft(createEmptyCharacter("main"));
    setPromptOpen(false);
    setPromptValue("");
    setCropSource("");
  };

  const visibleCharacters = Object.entries(characters).filter(([, character]) => {
    const type = character.type === "main" || character.type === "主角" ? "main" : "npc";
    return type === subTab;
  });
  const relationEntries = Object.entries(relations);
  const mainSelectorCharacters = Object.entries(characters).filter(([, character]) => {
    const type = character.type === "main" || character.type === "主角" ? "main" : "npc";
    return type === "main";
  });
  const npcSelectorCharacters = Object.entries(characters).filter(([, character]) => {
    const type = character.type === "main" || character.type === "主角" ? "main" : "npc";
    return type === "npc";
  });
  const selectorKeyword = selectorSearch.trim().toLowerCase();
  const meSelectorCharacters = Object.entries(meProfiles);
  const selectorGroups = [
    { title: "我 (MY PERSONAS)", items: meSelectorCharacters.map(([id]) => [id, getCharacterData(id)]) },
    { title: "MAIN CAST", items: mainSelectorCharacters.map(([id]) => [id, getCharacterData(id)]) },
    { title: "NPC", items: npcSelectorCharacters.map(([id]) => [id, getCharacterData(id)]) },
  ].map((group) => ({
    ...group,
    items: group.items.filter(([, character]) => {
      if (!selectorKeyword) return true;
      return `${character.name} ${character.identity}`.toLowerCase().includes(selectorKeyword);
    }),
  }));

  const uploadAvatar = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    readAvatarSource(file, setCropSource);
    event.target.value = "";
  };

  const saveCharacter = () => {
    const name = draft.name.trim();
    if (!name || name === "构思中...") {
      window.alert("请提供有效的角色姓名");
      return;
    }
    const id = editingId || `char_${Date.now()}`;
    setCharacters((current) => ({
      ...current,
      [id]: {
        ...draft,
        id,
        name,
        type: editingType,
      },
    }));
    if (previewId === id) setPreviewId(id);
    closeEditor();
  };

  const deleteCharacter = () => {
    if (!editingId) return;
    if (!window.confirm(`删除操作不可逆，是否确认销毁档案 [ ${draft.name || "未命名"} ]？`)) return;
    const deletedId = editingId;
    setCharacters((current) => {
      const next = { ...current };
      delete next[deletedId];
      return next;
    });
    setRelations((current) => Object.fromEntries(
      Object.entries(current).filter(([, relation]) => relation.charA !== deletedId && relation.charB !== deletedId),
    ));
    if (previewId === deletedId) setPreviewId(null);
    closeEditor();
  };

  const openRelationEditor = (id) => {
    setEditingRelationId(id);
    const currentRelation = id && relations[id] ? relations[id] : null;
    setRelationDraft(currentRelation ? {
      ...createEmptyRelation(),
      ...currentRelation,
      typeA: currentRelation.typeA || currentRelation.type || "挚友",
      typeB: currentRelation.typeB || currentRelation.type || "挚友",
      customTypeA: currentRelation.customTypeA || currentRelation.customType || "",
      customTypeB: currentRelation.customTypeB || currentRelation.customType || "",
    } : createEmptyRelation());
    setRelationEditorOpen(true);
  };

  const closeRelationEditor = () => {
    setRelationEditorOpen(false);
    setEditingRelationId(null);
    setRelationDraft(createEmptyRelation());
    setSelectorOpen(false);
    setSelectorSearch("");
  };

  const saveRelation = () => {
    if (!relationDraft.charA || !relationDraft.charB) {
      window.alert("请选择关系双方人物");
      return;
    }
    if (relationDraft.charA === relationDraft.charB) {
      window.alert("关系双方不能是同一个人物");
      return;
    }
    if (relationDraft.typeA === "custom" && !relationDraft.customTypeA.trim()) {
      window.alert("请填写 A 对 B 的自定义关系名称");
      return;
    }
    if (relationDraft.typeB === "custom" && !relationDraft.customTypeB.trim()) {
      window.alert("请填写 B 对 A 的自定义关系名称");
      return;
    }
    const id = editingRelationId || `rel_${Date.now()}`;
    setRelations((current) => ({
      ...current,
      [id]: {
        ...relationDraft,
        id,
        type: relationDraft.typeA || relationDraft.type,
        customType: relationDraft.customTypeA.trim(),
        customTypeA: relationDraft.customTypeA.trim(),
        customTypeB: relationDraft.customTypeB.trim(),
        viewA: relationDraft.viewA.trim(),
        viewB: relationDraft.viewB.trim(),
      },
    }));
    closeRelationEditor();
  };

  const deleteRelation = () => {
    if (!editingRelationId) return;
    if (!window.confirm("是否删除这条关系？")) return;
    setRelations((current) => {
      const next = { ...current };
      delete next[editingRelationId];
      return next;
    });
    closeRelationEditor();
  };

  const openCharacterSelector = (target) => {
    setSelectorTarget(target);
    setSelectorSearch("");
    setSelectorOpen(true);
  };

  const selectRelationCharacter = (id) => {
    patchRelationDraft({ [selectorTarget]: id });
    setSelectorOpen(false);
  };

  const beginGenerate = () => {
    setPromptValue("");
    setPromptOpen(true);
  };

  const generateCharacter = async (keyword) => {
    if (!keyword) return;

    const apiState = parseConfigs(window.localStorage.getItem(STORAGE_KEY));
    const endpoint = apiState.mainConfigs.find((item) => item.id === apiState.selectedMainId) || apiState.mainDraft;
    const model = endpoint?.model || endpoint?.customModel;
    if (!endpoint?.apiKey || !endpoint?.baseUrl || !model) {
      window.alert("提示：请先到设置里的 API 设置填写并保存主 API。");
      return;
    }

    const roleName = editingType === "main" ? "核心主角" : "剧情NPC";
    const systemPrompt = `你是一个设定集生成器。根据用户关键词，生成一个详细的${roleName}档案。
必须严格返回 JSON，不能包含任何 Markdown 或多余文本。
键名如下：
{
  "name": "角色名称",
  "identity": "身份或职业",
  "personality": "性格特点",
  "appearance": "外貌衣着特征",
  "persona": "详细的生平背景故事，不少于150字"
}`;

    setGenerating(true);
    patchDraft({
      name: "构思中...",
      identity: "构思中...",
      appearance: "构思中...",
      personality: "构思中...",
      persona: "构思中...",
    });
    try {
      let url = endpoint.baseUrl.replace(/\/+$/, "");
      if (!url.endsWith("/v1")) url += "/v1";
      const response = await fetch(`${url}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${endpoint.apiKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `关键词：${keyword}。` },
          ],
          temperature: 0.85,
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      let content = data?.choices?.[0]?.message?.content || "";
      const match = content.match(/\{[\s\S]*\}/);
      if (match) content = match[0];
      const generated = JSON.parse(content);
      patchDraft({
        name: generated.name || "",
        identity: generated.identity || "",
        appearance: generated.appearance || "",
        personality: generated.personality || "",
        persona: generated.persona || "",
      });
    } catch {
      window.alert("生成请求失败，请检查网络和 API 引擎配置。");
      setDraft((current) => ({
        ...current,
        name: current.name === "构思中..." ? "" : current.name,
        identity: current.identity === "构思中..." ? "" : current.identity,
        appearance: current.appearance === "构思中..." ? "" : current.appearance,
        personality: current.personality === "构思中..." ? "" : current.personality,
        persona: current.persona === "构思中..." ? "" : current.persona,
      }));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="screen-view character-view">
      <div className="mag-bg-decor">
        <div className="mag-circle-1"></div>
        <div className="mag-circle-2"></div>
        <div className="mag-crosshair mag-crosshair-a"></div>
        <div className="mag-crosshair mag-crosshair-b"></div>
      </div>

      <header className="mag-header">
        <div className="mag-vol">VOL. 01 - CAST</div>
        <h2>ARCHIVES.</h2>
        <div className="mag-tabs">
          {[
            ["main", "主要人物"],
            ["npc", "NPC 列表"],
            ["relation", "关系列表"],
          ].map(([id, label]) => (
            <button className={subTab === id ? "active" : ""} key={id} onClick={() => setSubTab(id)}>
              {label}
            </button>
          ))}
        </div>
      </header>

      {subTab === "relation" ? (
        <div className="mag-list-container">
          <button className="mag-add-relation-btn" onClick={() => openRelationEditor(null)}>
            + ADD NEW BOND / 添加关系
          </button>
          {relationEntries.length ? (
            <div className="relation-cards-container">
              {relationEntries.map(([id, relation]) => {
                const charA = getCharacterData(relation.charA);
                const charB = getCharacterData(relation.charB);
                return (
                  <button className="bond-card" key={id} onClick={() => openRelationEditor(id)}>
                    <div className="bond-header">
                      <div className="bond-char">
                        <div className="bond-avatar"><AvatarContent character={charA} /></div>
                        <span className="bond-name">{charA.name}</span>
                      </div>
                      <div className="bond-line-container">
                        <div className="bond-line"></div>
                        <span className="bond-badge">BOND</span>
                      </div>
                      <div className="bond-char">
                        <div className="bond-avatar"><AvatarContent character={charB} /></div>
                        <span className="bond-name">{charB.name}</span>
                      </div>
                    </div>
                    <div className="bond-direction-summary">
                      <span>
                        <em>{charA.name} → {charB.name}</em>
                        <strong>{getRelationLabel(relation, "A")}</strong>
                      </span>
                      <span>
                        <em>{charB.name} → {charA.name}</em>
                        <strong>{getRelationLabel(relation, "B")}</strong>
                      </span>
                    </div>
                    <div className="bond-details">
                      <div className="bond-view">
                        <span className="bond-view-title">{charA.name} 对 {charB.name} · {getRelationLabel(relation, "A")}</span>
                        <p className="bond-view-text">{relation.viewA || "暂无视角描述"}</p>
                      </div>
                      <div className="bond-view">
                        <span className="bond-view-title">{charB.name} 对 {charA.name} · {getRelationLabel(relation, "B")}</span>
                        <p className="bond-view-text">{relation.viewB || "暂无视角描述"}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mag-empty relation-empty">
              <span>RELATION GRAPH</span>
              <div></div>
              <em>NO BOND YET</em>
            </div>
          )}
        </div>
      ) : (
        <div className="mag-grid">
          {visibleCharacters.map(([id, character]) => (
            <button className="mag-card" key={id} onClick={() => openCharacterPreview(id, subTab)}>
              <span className="mag-card-id">NO.{id.slice(-4)}</span>
              <div className="mag-avatar-box">
                {character.avatar ? (
                  <img src={character.avatar} alt={character.name || "角色头像"} />
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4Zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4Z" />
                  </svg>
                )}
              </div>
              <strong>{character.name || "UNNAMED"}</strong>
              <small>{character.identity || "Unknown Identity"}</small>
            </button>
          ))}
          <button className="mag-card mag-add-btn" onClick={() => openEditor(null, subTab)}>
            <span>+</span>
            <small>{subTab === "main" ? "NEW MAIN" : "NEW NPC"}</small>
          </button>
        </div>
      )}

      {previewCharacter && (
        <section className="char-preview-page">
          <div className="preview-nav">
            <button className="preview-back" onClick={closeCharacterPreview} aria-label="返回">
              <ChevronLeft size={22} />
            </button>
          </div>
          <div className="char-pv-hero">
            <div className="char-pv-img">
              {previewCharacter.avatar ? (
                <img src={previewCharacter.avatar} alt={previewCharacter.name || "角色头像"} />
              ) : (
                <AvatarContent character={previewCharacter} />
              )}
            </div>
          </div>
          <div className="char-pv-content">
            <div className="char-pv-tagline">
              <span className="char-pv-tag">{previewType === "main" ? "MAIN CHAR" : "NPC"}</span>
              <span className="char-pv-tag outline">{getWorldbookLabel(previewCharacter.worldview)}</span>
            </div>
            <div className="char-pv-name">{previewCharacter.name || "UNNAMED"}</div>
            <section className="char-pv-section">
              <div className="char-pv-label">IDENTITY</div>
              <div className="char-pv-text">{previewCharacter.identity || "No record."}</div>
            </section>
            <section className="char-pv-section">
              <div className="char-pv-label">APPEARANCE</div>
              <div className="char-pv-text">{previewCharacter.appearance || "No record."}</div>
            </section>
            <section className="char-pv-section">
              <div className="char-pv-label">PERSONALITY</div>
              <div className="char-pv-text">{previewCharacter.personality || "No record."}</div>
            </section>
            <section className="char-pv-section char-pv-archive">
              <div className="char-pv-label">ARCHIVE</div>
              <div className="char-pv-text">{previewCharacter.persona || "No background record."}</div>
            </section>
          </div>
          <button className="fab-edit" onClick={() => openEditor(previewId, previewType)} aria-label="编辑档案">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 17.3V21h3.8L17.8 9.9l-3.7-3.7L3 17.3Zm17.7-10.2c.4-.4.4-1 0-1.4l-2.4-2.4c-.4-.4-1-.4-1.4 0l-1.8 1.8 3.7 3.7 1.9-1.7Z" />
            </svg>
          </button>
        </section>
      )}

      {relationEditorOpen && (
        <section className="character-edit-page relation-edit-page">
          <header className="character-edit-header">
            <button onClick={closeRelationEditor}>
              <ChevronLeft size={20} />
              <span>返回</span>
            </button>
            <strong>{editingRelationId ? "编辑羁绊" : "缔结新羁绊"}</strong>
            <span></span>
          </header>
          <div className="character-edit-container relation-edit-container">
            <section className="character-card relation-builder-card">
              <div className="relation-pair-row">
                {["charA", "charB"].map((target, index) => {
                  const selected = relationDraft[target] ? getCharacterData(relationDraft[target]) : null;
                  return (
                    <button className="rel-char-box" key={target} onClick={() => openCharacterSelector(target)}>
                      <span className="rel-avatar"><AvatarContent character={selected} /></span>
                      <span className="rel-name">{selected?.name || "点击选择人物"}</span>
                      <span className="rel-hint">人物 {index === 0 ? "A" : "B"}</span>
                    </button>
                  );
                })}
              </div>
              <div className="relation-type-grid">
                <label className="character-field">
                  <span><i></i>A 对 B / Bond Type</span>
                  <select
                    className="character-input"
                    value={relationDraft.typeA || relationDraft.type}
                    onChange={(event) => patchRelationDraft({ typeA: event.target.value, type: event.target.value })}
                  >
                    {relationTypes.map((type) => (
                      <option value={type} key={type}>{type === "custom" ? "自定义关系" : type}</option>
                    ))}
                  </select>
                </label>
                <label className="character-field">
                  <span><i></i>B 对 A / Bond Type</span>
                  <select
                    className="character-input"
                    value={relationDraft.typeB || relationDraft.type}
                    onChange={(event) => patchRelationDraft({ typeB: event.target.value })}
                  >
                    {relationTypes.map((type) => (
                      <option value={type} key={type}>{type === "custom" ? "自定义关系" : type}</option>
                    ))}
                  </select>
                </label>
              </div>
              {(relationDraft.typeA === "custom" || relationDraft.typeB === "custom") && (
                <div className="relation-type-grid">
                  {relationDraft.typeA === "custom" && (
                    <label className="character-field">
                      <span><i></i>A 对 B 自定义 / Custom</span>
                      <input
                        className="character-input"
                        value={relationDraft.customTypeA}
                        onChange={(event) => patchRelationDraft({ customTypeA: event.target.value, customType: event.target.value })}
                        placeholder="例如：秘密守护"
                      />
                    </label>
                  )}
                  {relationDraft.typeB === "custom" && (
                    <label className="character-field">
                      <span><i></i>B 对 A 自定义 / Custom</span>
                      <input
                        className="character-input"
                        value={relationDraft.customTypeB}
                        onChange={(event) => patchRelationDraft({ customTypeB: event.target.value })}
                        placeholder="例如：危险依赖"
                      />
                    </label>
                  )}
                </div>
              )}
            </section>
            <section className="character-card">
              <label className="character-field">
                <span><i></i>{relationDraft.charA ? getCharacterData(relationDraft.charA).name : "A"} 对 {relationDraft.charB ? getCharacterData(relationDraft.charB).name : "B"} 的看法</span>
                <textarea
                  className="character-input"
                  rows="4"
                  value={relationDraft.viewA}
                  onChange={(event) => patchRelationDraft({ viewA: event.target.value })}
                  placeholder="记录人物 A 对人物 B 的态度、误解或秘密"
                />
              </label>
              <label className="character-field">
                <span><i></i>{relationDraft.charB ? getCharacterData(relationDraft.charB).name : "B"} 对 {relationDraft.charA ? getCharacterData(relationDraft.charA).name : "A"} 的看法</span>
                <textarea
                  className="character-input"
                  rows="4"
                  value={relationDraft.viewB}
                  onChange={(event) => patchRelationDraft({ viewB: event.target.value })}
                  placeholder="记录人物 B 对人物 A 的态度、牵绊或目标"
                />
              </label>
            </section>
            <div className="character-actions relation-actions">
              {editingRelationId && <button className="character-danger" onClick={deleteRelation}>删除</button>}
              <button className="character-save" onClick={saveRelation}>{editingRelationId ? "保存羁绊" : "建立羁绊"}</button>
            </div>
          </div>
        </section>
      )}

      {selectorOpen && (
        <section className="char-selector-modal active">
          <header className="selector-header">
            <button className="selector-close" onClick={() => setSelectorOpen(false)}>
              <ChevronLeft size={19} />
              <span>返回</span>
            </button>
            <strong className="selector-title">选择人物</strong>
            <span></span>
          </header>
          <div className="search-bar-container">
            <div className="search-bar">
              <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m20 20-4.6-4.6m2.1-5.2a7.3 7.3 0 1 1-14.6 0 7.3 7.3 0 0 1 14.6 0Z" />
              </svg>
              <input value={selectorSearch} onChange={(event) => setSelectorSearch(event.target.value)} placeholder="搜索姓名或身份" autoFocus />
            </div>
          </div>
          <div className="selector-list">
            {selectorGroups.map((group) => (
              group.items.length ? (
                <div className="selector-group" key={group.title}>
                  <div className="selector-group-title">{group.title}</div>
                  {group.items.map(([id, character]) => (
                    <button className="selector-item" key={id} onClick={() => selectRelationCharacter(id)}>
                      <span className="selector-avatar"><AvatarContent character={character} /></span>
                      <span className="selector-copy">
                        <strong className="selector-name">{character.name}</strong>
                        <em className="selector-identity">{character.identity}</em>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null
            ))}
          </div>
        </section>
      )}

      {editorOpen && (
        <section className="character-edit-page">
          <header className="character-edit-header">
            <button onClick={closeEditor}>
              <ChevronLeft size={20} />
              <span>返回</span>
            </button>
            <strong>{editingId ? "编辑档案" : "新建角色"}</strong>
            <button className={generating ? "breathing" : ""} onClick={beginGenerate} aria-label="AI 构思">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2ZM7.5 18c-.8 0-1.5-.7-1.5-1.5S6.7 15 7.5 15 9 15.7 9 16.5 8.3 18 7.5 18Zm0-9C6.7 9 6 8.3 6 7.5S6.7 6 7.5 6 9 6.7 9 7.5 8.3 9 7.5 9Zm4.5 4.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5Zm4.5 4.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5Zm0-9c-.8 0-1.5-.7-1.5-1.5S15.7 6 16.5 6 18 6.7 18 7.5 17.3 9 16.5 9Z" />
              </svg>
            </button>
          </header>
          <div className="character-edit-container">
            <section className="character-card profile-card">
              <div className="profile-row">
                <label className="avatar-uploader">
                  <input type="file" accept="image/*" onChange={uploadAvatar} />
                  {draft.avatar ? (
                    <img src={draft.avatar} alt="角色头像" />
                  ) : (
                    <svg className="avatar-placeholder" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4Zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4Z" />
                    </svg>
                  )}
                </label>
                <div className="profile-info">
                  <input
                    className="character-input character-name-input"
                    value={draft.name}
                    onChange={(event) => patchDraft({ name: event.target.value })}
                    placeholder="输入角色姓名"
                  />
                </div>
              </div>
            </section>
            <section className="character-card">
              <label className="character-field">
                <span><i></i>身份 / Identity</span>
                <input className="character-input" value={draft.identity} onChange={(event) => patchDraft({ identity: event.target.value })} placeholder="如: 帝国第一骑士 / 魔法学院导师" />
              </label>
              <label className="character-field">
                <span><i></i>关联世界书 / Worldbook</span>
                <select className="character-input" value={draft.worldview} onChange={(event) => patchDraft({ worldview: event.target.value })}>
                  <option value="">尚未关联世界书</option>
                  {worldbookOptions.map((world) => (
                    <option value={world.id} key={world.id}>{world.name} · {world.genre}</option>
                  ))}
                  {draft.worldview && !worldbookOptions.some((world) => world.id === draft.worldview) && (
                    <option value={draft.worldview}>{draft.worldview}</option>
                  )}
                </select>
              </label>
            </section>
            <section className="character-card">
              <label className="character-field">
                <span><i></i>容貌特征 / Appearance</span>
                <textarea className="character-input" rows="2" value={draft.appearance} onChange={(event) => patchDraft({ appearance: event.target.value })} placeholder="发色瞳色、穿着风格等特征描写" />
              </label>
              <label className="character-field">
                <span><i></i>性格癖好 / Personality</span>
                <textarea className="character-input" rows="2" value={draft.personality} onChange={(event) => patchDraft({ personality: event.target.value })} placeholder="角色的性格、习惯、口头禅等" />
              </label>
              <label className="character-field">
                <span><i></i>生平履历 / Persona</span>
                <textarea className="character-input" rows="6" value={draft.persona} onChange={(event) => patchDraft({ persona: event.target.value })} placeholder="详细的背景故事与人设长文本" />
              </label>
            </section>
            <div className="character-actions">
              {editingId && <button className="character-danger" onClick={deleteCharacter}>删除</button>}
              <button className="character-save" onClick={saveCharacter}>保存档案</button>
            </div>
          </div>
        </section>
      )}

      {cropSource && (
        <AvatarCropModal
          source={cropSource}
          onCancel={() => setCropSource("")}
          onConfirm={(avatar) => {
            patchDraft({ avatar });
            setCropSource("");
          }}
        />
      )}

      {promptOpen && (
        <div className="character-prompt">
          <div className="prompt-box">
            <strong>设定推演系统</strong>
            <p>请输入你想赋予此角色的特质关键词<br />如：高冷反派 / 温柔学姐</p>
            <input value={promptValue} onChange={(event) => setPromptValue(event.target.value)} placeholder="输入关键词..." autoFocus />
            <div>
              <button onClick={() => setPromptOpen(false)}>取消</button>
              <button
                onClick={() => {
                  const value = promptValue.trim();
                  setPromptOpen(false);
                  generateCharacter(value);
                }}
              >
                生成
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function MeAppScreen({ onChildPageChange }) {
  const [profiles, setProfiles] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem(ME_PROFILE_STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  });
  const [previewId, setPreviewId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(createEmptyMeProfile());
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptValue, setPromptValue] = useState("");
  const [generating, setGenerating] = useState(false);
  const [cropSource, setCropSource] = useState("");

  useEffect(() => {
    onChildPageChange?.(Boolean(previewId || editorOpen));
    return () => onChildPageChange?.(false);
  }, [previewId, editorOpen, onChildPageChange]);

  useEffect(() => {
    window.localStorage.setItem(ME_PROFILE_STORAGE_KEY, JSON.stringify(profiles));
  }, [profiles]);

  const profileEntries = Object.entries(profiles);
  const previewProfile = previewId ? profiles[previewId] : null;
  const patchDraft = (patch) => setDraft((current) => ({ ...current, ...patch }));

  const uploadMeAvatar = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    readAvatarSource(file, setCropSource);
    event.target.value = "";
  };

  const openMeEditor = (id) => {
    setEditingId(id);
    setDraft(id && profiles[id] ? { ...createEmptyMeProfile(), ...profiles[id], id } : createEmptyMeProfile());
    setEditorOpen(true);
  };

  const closeMeEditor = () => {
    setEditorOpen(false);
    setEditingId(null);
    setDraft(createEmptyMeProfile());
    setPromptOpen(false);
    setPromptValue("");
    setCropSource("");
  };

  const saveMeProfile = () => {
    const name = draft.name.trim();
    if (!name || name === "构思中...") {
      window.alert("请提供有效的姓名");
      return;
    }
    const id = editingId || `me_${Date.now()}`;
    setProfiles((current) => ({
      ...current,
      [id]: {
        ...draft,
        id,
        type: "user",
        name,
      },
    }));
    setPreviewId(id);
    closeMeEditor();
  };

  const deleteMeProfile = () => {
    if (!editingId) return;
    if (!window.confirm(`删除操作不可逆，是否确认销毁此身份 [ ${draft.name || "未命名"} ]？`)) return;
    const deletedId = editingId;
    setProfiles((current) => {
      const next = { ...current };
      delete next[deletedId];
      return next;
    });
    if (previewId === deletedId) setPreviewId(null);
    closeMeEditor();
  };

  const generateMeProfile = async (keyword) => {
    if (!keyword) return;

    const apiState = parseConfigs(window.localStorage.getItem(STORAGE_KEY));
    const endpoint = apiState.mainConfigs.find((item) => item.id === apiState.selectedMainId) || apiState.mainDraft;
    const model = endpoint?.model || endpoint?.customModel;
    if (!endpoint?.apiKey || !endpoint?.baseUrl || !model) {
      window.alert("提示：请先到设置里的 API 设置填写并保存主 API。");
      return;
    }

    const systemPrompt = `你是一个设定集生成器。根据用户关键词，生成一个详细的【主角身份档案】（玩家自身扮演用）。
必须严格返回 JSON，不能包含任何 Markdown 或多余文本。
键名如下：
{
  "name": "名字",
  "identity": "身份或职业",
  "personality": "性格特点",
  "appearance": "外貌衣着特征",
  "persona": "背景故事，不少于150字"
}`;

    setGenerating(true);
    patchDraft({
      name: "构思中...",
      identity: "构思中...",
      appearance: "构思中...",
      personality: "构思中...",
      persona: "构思中...",
    });
    try {
      let url = endpoint.baseUrl.replace(/\/+$/, "");
      if (!url.endsWith("/v1")) url += "/v1";
      const response = await fetch(`${url}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${endpoint.apiKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `关键词：${keyword}。` },
          ],
          temperature: 0.85,
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      let content = data?.choices?.[0]?.message?.content || "";
      const match = content.match(/\{[\s\S]*\}/);
      if (match) content = match[0];
      const generated = JSON.parse(content);
      patchDraft({
        name: generated.name || "",
        identity: generated.identity || "",
        appearance: generated.appearance || "",
        personality: generated.personality || "",
        persona: generated.persona || "",
      });
    } catch {
      window.alert("生成失败，请检查网络和 API 引擎配置。");
      setDraft((current) => ({
        ...current,
        name: current.name === "构思中..." ? "" : current.name,
        identity: current.identity === "构思中..." ? "" : current.identity,
        appearance: current.appearance === "构思中..." ? "" : current.appearance,
        personality: current.personality === "构思中..." ? "" : current.personality,
        persona: current.persona === "构思中..." ? "" : current.persona,
      }));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="screen-view me-app-view me-theme">
      <div className="me-bg-decor">
        <div className="me-shape-1"></div>
        <div className="me-shape-2"></div>
      </div>
      <header className="me-header">
        <div className="me-vol">
          <span>主角档案</span>
          <em>Director</em>
        </div>
        <h2>
          <span>我的身份</span>
          <em>My Personas.</em>
        </h2>
      </header>
      <div className="me-list-container">
        {profileEntries.map(([id, profile]) => (
          <button className="me-card" key={id} onClick={() => setPreviewId(id)}>
            <span className="me-card-avatar">
              <AvatarContent character={profile} />
            </span>
            <span className="me-card-info">
              <span className="me-card-id">档案编号 <em>ID: {id.slice(-5)}</em></span>
              <strong className="me-card-name">{profile.name || "未命名"}</strong>
              <span className="me-card-identity">{profile.identity || "主角身份"}</span>
            </span>
          </button>
        ))}
        <button className="me-add-btn" onClick={() => openMeEditor(null)}>
          <span>+ 建立新身份</span>
          <em>Create New Persona</em>
        </button>
      </div>

      {previewProfile && (
        <section className="me-preview-page me-theme">
          <div className="preview-nav">
            <button className="me-edit-back" onClick={() => setPreviewId(null)} aria-label="返回">
              <ChevronLeft size={16} />
              <span>返回</span>
              <em>Back</em>
            </button>
          </div>
          <div className="me-pv-container">
            <div className="me-pv-frame">
              <AvatarContent character={previewProfile} />
            </div>
            <div className="me-pv-typography">
              <div className="me-pv-id">档案编号 <em>ID.{previewId.slice(-4).toUpperCase()}</em></div>
              <div className="me-pv-name">{previewProfile.name || "未命名"}</div>
              <div className="me-pv-identity">{previewProfile.identity || "未知身份"}</div>
            </div>
            <div className="me-pv-details">
              <section className="me-pv-text-block">
                <div className="me-pv-text-title"><span>容貌特征</span><em>Appearance</em></div>
                <div className="me-pv-text-content">{previewProfile.appearance || "暂无记录"}</div>
              </section>
              <section className="me-pv-text-block">
                <div className="me-pv-text-title"><span>性格特点</span><em>Personality</em></div>
                <div className="me-pv-text-content">{previewProfile.personality || "暂无记录"}</div>
              </section>
              <section className="me-pv-text-block">
                <div className="me-pv-text-title"><span>背景档案</span><em>Archive</em></div>
                <div className="me-pv-text-content">{previewProfile.persona || "暂无背景记录"}</div>
              </section>
            </div>
          </div>
          <button className="me-preview-edit" onClick={() => openMeEditor(previewId)} aria-label="编辑档案">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 17.3V21h3.8L17.8 9.9l-3.7-3.7L3 17.3Zm17.7-10.2c.4-.4.4-1 0-1.4l-2.4-2.4c-.4-.4-1-.4-1.4 0l-1.8 1.8 3.7 3.7 1.9-1.7Z" />
            </svg>
          </button>
        </section>
      )}

      {editorOpen && (
        <section className="me-edit-page me-theme">
          <div className="me-bg-decor">
            <div className="me-shape-2 me-edit-shape"></div>
          </div>
          <nav className="me-edit-nav">
            <button className="me-edit-back" onClick={closeMeEditor}>
              <ChevronLeft size={16} />
              <span>返回</span>
              <em>Back</em>
            </button>
            <button className={generating ? "me-edit-dice breathing" : "me-edit-dice"} onClick={() => setPromptOpen(true)} aria-label="AI 构思">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2ZM7.5 18c-.8 0-1.5-.7-1.5-1.5S6.7 15 7.5 15 9 15.7 9 16.5 8.3 18 7.5 18Zm0-9C6.7 9 6 8.3 6 7.5S6.7 6 7.5 6 9 6.7 9 7.5 8.3 9 7.5 9Zm4.5 4.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5Zm4.5 4.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5Zm0-9c-.8 0-1.5-.7-1.5-1.5S15.7 6 16.5 6 18 6.7 18 7.5 17.3 9 16.5 9Z" />
              </svg>
            </button>
          </nav>
          <div className="me-edit-hero">
            <label className="me-edit-avatar-wrapper">
              <input type="file" accept="image/*" onChange={uploadMeAvatar} />
              <span className="me-edit-avatar-inner">
                <AvatarContent character={draft} />
              </span>
            </label>
            <input
              className="me-signature-input"
              value={draft.name}
              onChange={(event) => patchDraft({ name: event.target.value })}
              placeholder="输入姓名 / Your Name"
            />
            <div className="me-edit-subtitle"><span>作者与主角</span><em>Author & Protagonist</em></div>
          </div>
          <div className="me-edit-body">
            <label className="me-edit-group">
              <span className="me-edit-label"><span>身份</span><em>Identity</em></span>
              <input className="me-edit-input" value={draft.identity} onChange={(event) => patchDraft({ identity: event.target.value })} placeholder="身份或称号 / Role or Title" />
            </label>
            <label className="me-edit-group">
              <span className="me-edit-label"><span>容貌</span><em>Appearance</em></span>
              <textarea className="me-edit-input" value={draft.appearance} onChange={(event) => patchDraft({ appearance: event.target.value })} placeholder="外貌特征 / Physical traits" />
            </label>
            <label className="me-edit-group">
              <span className="me-edit-label"><span>性格</span><em>Personality</em></span>
              <textarea className="me-edit-input" value={draft.personality} onChange={(event) => patchDraft({ personality: event.target.value })} placeholder="性格特点 / Character traits" />
            </label>
            <label className="me-edit-group">
              <span className="me-edit-label"><span>档案</span><em>Archive</em></span>
              <textarea className="me-edit-input large" value={draft.persona} onChange={(event) => patchDraft({ persona: event.target.value })} placeholder="背景故事 / Background story" />
            </label>
            <div className="me-edit-actions">
              {editingId && <button className="me-action-btn danger" onClick={deleteMeProfile}><span>删除</span><em>Delete</em></button>}
              <button className="me-action-btn primary" onClick={saveMeProfile}><span>保存档案</span><em>Save Archive</em></button>
            </div>
          </div>
        </section>
      )}

      {cropSource && (
        <AvatarCropModal
          source={cropSource}
          onCancel={() => setCropSource("")}
          onConfirm={(avatar) => {
            patchDraft({ avatar });
            setCropSource("");
          }}
        />
      )}

      {promptOpen && (
        <div className="character-prompt">
          <div className="prompt-box">
            <strong>设定推演系统</strong>
            <p>请输入你想扮演的主角特质<br />如：流浪法师 / 财阀千金</p>
            <input value={promptValue} onChange={(event) => setPromptValue(event.target.value)} placeholder="输入关键词..." autoFocus />
            <div>
              <button onClick={() => setPromptOpen(false)}>取消</button>
              <button
                onClick={() => {
                  const value = promptValue.trim();
                  setPromptOpen(false);
                  generateMeProfile(value);
                }}
              >
                生成
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function SettingsScreen({ onOpen }) {
  return (
    <section className="screen-view settings-view">
      <div className="section-title">
        <span>设置</span>
        <em>Settings</em>
      </div>
      <div className="settings-list">
        {settingsItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={`setting-row ${item.featured ? "featured" : ""}`}
              key={item.id}
              onClick={() => onOpen(item)}
            >
              <span className="setting-icon">
                <Icon size={20} strokeWidth={1.7} />
              </span>
              <span>{item.label}</span>
              <ChevronRight size={17} />
            </button>
          );
        })}
      </div>
      <p className="version-label">Ccat OS V0.2.22</p>
    </section>
  );
}

function TabSvgIcon({ id }) {
  return (
    <svg className="tab-svg" viewBox="0 0 24 24" aria-hidden="true">
      {id === "home" && (
        <>
          <path d="M3.6 11.1 12 4.1l8.4 7h-2v8.4h-4.2v-5.4H9.8v5.4H5.6v-8.4h-2Z" />
          <path className="tab-knockout" d="M10.4 19.5v-4.8h3.2v4.8" />
        </>
      )}
      {id === "characters" && (
        <>
          <circle cx="12" cy="7" r="3.4" />
          <path d="M6.1 18.8c.5-4.2 2.7-6.1 5.9-6.1s5.4 1.9 5.9 6.1H6.1Z" />
          <path className="tab-soft-base" d="M5.5 20h13" />
        </>
      )}
      {id === "me" && (
        <>
          <circle cx="12" cy="12" r="8.1" />
          <circle className="tab-avatar-cutout" cx="12" cy="8.8" r="2.4" />
          <path className="tab-avatar-cutout" d="M7.6 17.2c.8-2.5 2.3-3.6 4.4-3.6s3.6 1.1 4.4 3.6H7.6Z" />
        </>
      )}
      {id === "settings" && (
        <g>
          <path d="M10.2 3.3h3.6l.5 2.1c.5.2.9.4 1.3.7l2-.7 1.8 3.1-1.6 1.4c0 .3.1.7.1 1s0 .7-.1 1l1.6 1.4-1.8 3.1-2-.7c-.4.3-.9.5-1.3.7l-.5 2.1h-3.6l-.5-2.1c-.5-.2-.9-.4-1.3-.7l-2 .7-1.8-3.1 1.6-1.4c0-.3-.1-.7-.1-1s0-.7.1-1L4.6 8.5l1.8-3.1 2 .7c.4-.3.9-.5 1.3-.7l.5-2.1Z" />
          <circle className="tab-gear-cutout" cx="12" cy="11" r="2.7" />
        </g>
      )}
    </svg>
  );
}

function BottomTabs({ active, onChange }) {
  return (
    <nav className="bottom-tabs">
      {tabs.map((tab) => {
        const selected = active === tab.id;
        return (
          <button className={selected ? "active" : ""} key={tab.id} onClick={() => onChange(tab.id)}>
            <span className="tab-icon-wrap">
              <TabSvgIcon id={tab.id} />
            </span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ApiEndpoint({
  title,
  badge,
  value,
  onChange,
  onFetchModels,
  onSave,
  onTest,
  onDelete,
  saveLabel,
  namePlaceholder,
  headerAction,
}) {
  const options = value.availableModels.length ? value.availableModels : ["gpt-4.1", "gpt-4.1-mini", "gpt-4o-mini"];
  return (
    <div className="api-block api-engine-card">
      <div className="api-block-title">
        <span>
          {title}
          <em>{badge}</em>
        </span>
        {headerAction}
      </div>
      <label>
        <span>配置名称（必填）</span>
        <input value={value.name} onChange={(event) => onChange({ name: event.target.value })} placeholder={namePlaceholder} />
      </label>
      <label>
        <span>接口地址 (BASE URL)</span>
        <input value={value.baseUrl} onChange={(event) => onChange({ baseUrl: event.target.value })} placeholder="https://api.openai.com" />
      </label>
      <label>
        <span>访问凭证 (API KEY)</span>
        <input
          type="password"
          value={value.apiKey}
          onChange={(event) => onChange({ apiKey: event.target.value })}
          placeholder="sk-..."
        />
      </label>
      <label>
        <span>模型标识 (MODEL)</span>
        <input
          list={`${title}-models`}
          value={value.modelMode === "custom" ? value.customModel : value.model}
          onChange={(event) => onChange({ customModel: event.target.value, model: event.target.value, modelMode: "custom" })}
          placeholder="下拉选择或手动输入"
        />
        <datalist id={`${title}-models`}>
          {options.map((model) => (
            <option value={model} key={model} />
          ))}
        </datalist>
      </label>
      {value.availableModels.length > 0 && (
        <label>
          <span>已获取模型</span>
          <select
            className="model-choice-select"
            value={value.model}
            onChange={(event) => onChange({ model: event.target.value, customModel: "", modelMode: "manual" })}
          >
            {value.availableModels.map((model) => (
              <option value={model} key={model}>
                {model}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="api-model-actions">
        <button className="soft-api-button" onClick={onFetchModels}>获取模型</button>
        <button className="soft-api-button" onClick={onTest}>测试连接</button>
      </div>
      <label className="range-label api-temperature">
        <span>创造力 (TEMPERATURE)</span>
        <strong>{Number(value.temperature).toFixed(1)}</strong>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={value.temperature}
          onChange={(event) => onChange({ temperature: event.target.value })}
        />
      </label>
      <p className={`status-text ${value.testStatus}`}>{statusCopy(value.testStatus)}</p>
      <div className="api-actions">
        <button className="danger-api-button" onClick={onDelete}>删除</button>
        <button className="save-api-button" onClick={onSave}>{saveLabel}</button>
      </div>
    </div>
  );
}

function statusCopy(status) {
  if (status === "testing") return "测试中";
  if (status === "ok") return "连接可用";
  if (status === "error") return "需要检查配置";
  if (status === "models") return "模型已更新";
  return "等待配置";
}

function ApiNotice({ notice, onClose }) {
  if (!notice) return null;
  return (
    <div className="api-notice-backdrop" role="dialog" aria-modal="true">
      <div className={`api-notice ${notice.tone}`}>
        <strong>{notice.title}</strong>
        <p>{notice.message}</p>
        <button onClick={onClose}>确定</button>
      </div>
    </div>
  );
}

function ApiSettingsPage({ onBack }) {
  const [saved, setSaved] = useState(() => parseConfigs(window.localStorage.getItem(STORAGE_KEY)));
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, serializeConfigs(saved));
  }, [saved]);

  const patchEndpoint = (key, patch) => {
    const draftKey = key === "secondary" ? "secondaryDraft" : "mainDraft";
    setSaved((current) => ({
      ...current,
      [draftKey]: {
        ...current[draftKey],
        ...patch,
      },
    }));
  };

  const saveEndpoint = (key) => {
    const draftKey = key === "secondary" ? "secondaryDraft" : "mainDraft";
    const configsKey = key === "secondary" ? "secondaryConfigs" : "mainConfigs";
    const selectedKey = key === "secondary" ? "selectedSecondaryId" : "selectedMainId";

    setSaved((current) => {
      const normalized = normalizeEndpointConfig(current[draftKey]);
      const configs = Array.isArray(current[configsKey]) ? current[configsKey] : [];
      const exists = configs.some((item) => item.id === normalized.id);
      const nextConfigs = exists
        ? configs.map((item) => (item.id === normalized.id ? normalized : item))
        : [...configs, normalized];
      return {
        ...current,
        [configsKey]: nextConfigs,
        [selectedKey]: normalized.id,
        [draftKey]: normalized,
      };
    });
    setNotice({
      tone: "ok",
      title: "保存成功",
      message: key === "secondary" ? "副API配置已保存并设为当前使用。" : "主API配置已保存并设为当前使用。",
    });
  };

  const deleteEndpoint = (key) => {
    const configsKey = key === "secondary" ? "secondaryConfigs" : "mainConfigs";
    const selectedKey = key === "secondary" ? "selectedSecondaryId" : "selectedMainId";
    const draftKey = key === "secondary" ? "secondaryDraft" : "mainDraft";
    setSaved((current) => {
      const selectedId = current[selectedKey] || current[draftKey]?.id;
      const configs = Array.isArray(current[configsKey]) ? current[configsKey] : [];
      const nextConfigs = configs.filter((item) => item.id !== selectedId);
      const nextSelected = nextConfigs[0]?.id || "";
      return {
        ...current,
        [configsKey]: nextConfigs,
        [selectedKey]: nextSelected,
        [draftKey]: nextSelected
          ? nextConfigs[0]
          : normalizeEndpointConfig({
              ...createEmptyConfig()[key === "secondary" ? "secondary" : "main"],
              name: key === "secondary" ? "副API配置" : "主API配置",
            }),
      };
    });
  };

  const selectEndpoint = (key, id) => {
    const configsKey = key === "secondary" ? "secondaryConfigs" : "mainConfigs";
    const selectedKey = key === "secondary" ? "selectedSecondaryId" : "selectedMainId";
    const draftKey = key === "secondary" ? "secondaryDraft" : "mainDraft";
    setSaved((current) => {
      if (!id) {
        return {
          ...current,
          [selectedKey]: "",
          [draftKey]: normalizeEndpointConfig({
            ...createEmptyConfig()[key === "secondary" ? "secondary" : "main"],
            name: key === "secondary" ? "副API配置" : "主API配置",
          }),
        };
      }
      const config = current[configsKey].find((item) => item.id === id);
      if (!config) return current;
      return { ...current, [selectedKey]: id, [draftKey]: config };
    });
  };

  const loadModels = async (key) => {
    patchEndpoint(key, { testStatus: "testing" });
    try {
      const endpoint = key === "secondary" ? saved.secondaryDraft : saved.mainDraft;
      const models = await fetchModels(endpoint);
      patchEndpoint(key, { availableModels: models, model: models[0] || endpoint.model || "", customModel: "", modelMode: "manual", testStatus: "models" });
    } catch {
      patchEndpoint(key, { testStatus: "error" });
    }
  };

  const testEndpoint = async (key) => {
    patchEndpoint(key, { testStatus: "testing" });
    try {
      const endpoint = key === "secondary" ? saved.secondaryDraft : saved.mainDraft;
      const models = await fetchModels(endpoint);
      patchEndpoint(key, { availableModels: models, testStatus: "ok" });
      setNotice({
        tone: "ok",
        title: "连接成功",
        message: `已连接，检测到 ${models.length || 0} 个模型。`,
      });
    } catch {
      patchEndpoint(key, { testStatus: "error" });
      setNotice({
        tone: "error",
        title: "连接失败",
        message: "请检查 API Key、接口地址和网络状态。",
      });
    }
  };

  return (
    <section className="full-page api-page">
      <header className="page-header">
        <button className="api-back-button" onClick={onBack} aria-label="返回">
          <ChevronLeft size={20} />
          <span>返回</span>
        </button>
        <span>高级 API 配置</span>
        <span></span>
      </header>
      <div className="api-scroll">
        <div className="glass-form api-status-card">
          <div className="api-card-heading">
            <span>当前应用状态</span>
            <em>ACTIVE</em>
          </div>
          {saved.mainConfigs.length > 0 && (
            <label className="api-select-bar">
              <span>主API设置</span>
              <select
                value={saved.selectedMainId}
                onChange={(event) => selectEndpoint("main", event.target.value)}
              >
                {saved.mainConfigs.map((config) => (
                  <option value={config.id} key={config.id}>
                    {config.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {saved.secondaryEnabled && (
            <label className="api-select-bar">
              <span>副API设置</span>
              <select
                value={saved.selectedSecondaryId}
                onChange={(event) => selectEndpoint("secondary", event.target.value)}
              >
                <option value=""></option>
                {saved.secondaryConfigs.map((config) => (
                  <option value={config.id} key={config.id}>
                    {config.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <ApiEndpoint
          title="主引擎 (Main API)"
          badge="CORE"
          value={saved.mainDraft}
          onChange={(patch) => patchEndpoint("main", patch)}
          onFetchModels={() => loadModels("main")}
          onSave={() => saveEndpoint("main")}
          onTest={() => testEndpoint("main")}
          onDelete={() => deleteEndpoint("main")}
          saveLabel="保存主配置"
          namePlaceholder="例如： OpenAI GPT-4"
        />

        {!saved.secondaryEnabled && (
          <div className="glass-form api-enable-secondary">
            <button
              className="switch-row"
              onClick={() => setSaved((current) => ({ ...current, secondaryEnabled: !current.secondaryEnabled }))}
            >
              <span>启用副API</span>
              <i></i>
            </button>
          </div>
        )}

        {saved.secondaryEnabled && (
          <ApiEndpoint
            title="副引擎 (Sub API)"
            badge="BACKUP"
            value={saved.secondaryDraft}
            onChange={(patch) => patchEndpoint("secondary", patch)}
            onFetchModels={() => loadModels("secondary")}
            onSave={() => saveEndpoint("secondary")}
            onTest={() => testEndpoint("secondary")}
            onDelete={() => deleteEndpoint("secondary")}
            saveLabel="保存副配置"
            namePlaceholder="例如： Claude 3 Haiku"
            headerAction={(
              <button
                className="switch-row mini-switch on"
                onClick={() => setSaved((current) => ({ ...current, secondaryEnabled: !current.secondaryEnabled }))}
                aria-label="关闭副API"
              >
                <i></i>
              </button>
            )}
          />
        )}

        {saved.secondaryEnabled && (
          <div className="glass-form api-fallback-card">
            <div className="api-card-heading">
              <span>容错策略 (Fallback)</span>
            </div>
            <label>
              <span>失败重试次数</span>
              <select value={saved.retryCount} onChange={(event) => setSaved((current) => ({ ...current, retryCount: Number(event.target.value) }))}>
                {[0, 1, 2, 3, 4, 5].map((count) => (
                  <option value={count} key={count}>
                    {count === 0 ? "不重试（0）" : `${count} 次`}
                  </option>
                ))}
              </select>
            </label>
            <button
              className={`switch-row ${saved.failoverEnabled ? "on" : ""}`}
              onClick={() => setSaved((current) => ({ ...current, failoverEnabled: !current.failoverEnabled }))}
            >
              <span>主引擎失败时切换副引擎</span>
              <i></i>
            </button>
            <p className="helper-text">副AI一般用于总结记忆等任务。</p>
          </div>
        )}
      </div>
      <ApiNotice notice={notice} onClose={() => setNotice(null)} />
    </section>
  );
}

function GenericSettingPage({ item, onBack }) {
  const Icon = item.icon;
  return (
    <section className="full-page quiet-page">
      <header className="page-header">
        <button onClick={onBack} aria-label="返回">
          <ChevronLeft size={20} />
        </button>
        <span>{item.label}</span>
        <span></span>
      </header>
      <div className="quiet-center">
        <div className="large-glass-icon">
          <Icon size={34} strokeWidth={1.5} />
        </div>
      </div>
    </section>
  );
}

function WorkMap({ jobs, selectedId, radarId, onSelect }) {
  const selectedJob = jobs.find((job) => job.key === selectedId) || jobs[0];
  const radarJob = jobs.find((job) => job.key === radarId) || selectedJob;
  const ringLength = 452;
  const ringOffset = ringLength * (1 - Math.max(0, Math.min(1, radarJob.remainingRatio ?? 0)));
  return (
    <section className="work-map-panel" aria-label="工作地图">
      <svg className="work-map-lines" viewBox="0 0 390 470" aria-hidden="true">
        <path className="edge-road" d="M-18 40 C52 18 116 22 184 38 C252 54 316 28 408 18" />
        <path className="edge-road" d="M-20 452 C50 418 116 404 190 420 C260 436 320 414 410 380" />
        <path className="edge-road" d="M8 -16 C22 58 30 124 24 198 C18 276 38 354 62 488" />
        <path className="edge-road" d="M382 -18 C350 72 350 148 362 222 C376 306 356 380 326 492" />
        <path className="district" d="M-16 78 C60 72 104 78 154 88 C206 98 260 70 406 52" />
        <path className="district" d="M-18 132 C62 126 132 136 190 148 C252 160 312 128 410 126" />
        <path className="district" d="M-18 190 C64 184 118 190 170 214 C222 238 300 194 408 164" />
        <path className="district" d="M-20 262 C62 250 112 256 164 272 C220 290 292 254 410 216" />
        <path className="district" d="M-14 332 C56 312 104 310 158 324 C218 340 294 294 406 272" />
        <path className="district" d="M10 414 C78 366 126 350 180 360 C236 370 288 316 374 326" />
        <path className="district" d="M48 -12 C56 44 62 92 58 140 C54 202 76 254 90 318 C104 382 92 430 88 486" />
        <path className="district" d="M132 -12 C124 58 124 108 140 158 C156 206 134 266 148 328 C162 390 154 430 148 486" />
        <path className="district" d="M216 -12 C206 52 206 98 220 148 C236 204 206 262 224 322 C242 384 252 428 252 486" />
        <path className="district" d="M306 -12 C284 58 290 112 300 156 C314 214 280 264 304 326 C326 384 326 430 326 486" />
        <path className="minor" d="M18 36 C66 54 102 102 144 110 C188 118 238 152 328 142" />
        <path className="minor" d="M-6 104 C56 106 102 100 142 116 C184 132 232 116 292 98" />
        <path className="minor" d="M24 166 C86 158 128 166 164 188 C204 212 252 196 326 178" />
        <path className="minor" d="M20 232 C84 222 126 228 172 248 C218 268 278 236 350 216" />
        <path className="minor" d="M36 292 C96 274 132 286 180 304 C230 324 286 286 354 260" />
        <path className="minor" d="M42 382 C92 346 126 340 174 344 C222 350 262 316 330 304" />
        <path className="minor" d="M88 6 C104 76 104 134 100 192 C96 260 126 326 124 470" />
        <path className="minor" d="M176 0 C164 64 170 118 184 176 C198 232 170 292 196 468" />
        <path className="minor" d="M252 2 C236 78 246 136 260 190 C274 246 248 298 286 466" />
        <path className="minor" d="M342 8 C316 74 314 126 326 190 C338 252 300 320 346 456" />
        <path className="minor" d="M-10 356 C50 330 100 330 146 340 C214 354 270 318 338 300" />
        <path className="block" d="M74 96 h40 v30 h-40z" />
        <path className="block" d="M150 116 h52 v34 h-52z" />
        <path className="block" d="M236 78 h42 v32 h-42z" />
        <path className="block" d="M76 214 h48 v34 h-48z" />
        <path className="block" d="M150 240 h52 v38 h-52z" />
        <path className="block" d="M260 214 h50 v36 h-50z" />
        <path className="block" d="M172 344 h54 v34 h-54z" />
        <path className="block" d="M70 358 h42 v42 h-42z" />
        <path className="route" d={`M195 168 C196 224 192 256 195 282 L${(selectedJob.pin.x / 100) * 390} ${(selectedJob.pin.y / 100) * 470}`} />
        <path className="river" d="M402 14 C338 52 314 102 330 160 C346 220 386 246 356 292 C326 338 270 330 244 372 C224 406 220 438 232 478" />
        <path className="river-bank" d="M386 28 C324 68 306 106 320 160 C334 218 374 246 342 286 C312 324 260 324 232 362 C208 396 204 438 216 478" />
        <path className="river-bank" d="M418 4 C350 42 322 100 340 164 C358 224 398 250 368 300 C336 350 282 340 258 384 C238 420 236 448 250 478" />
        <circle className="radar-ring" cx="195" cy="168" r="86" />
        <circle className="radar-ring" cx="195" cy="168" r="114" />
        <circle className="radar-ring" cx="195" cy="168" r="142" />
      </svg>

      <div className="work-radar" aria-label="工作仪表盘">
        <svg viewBox="0 0 180 180" aria-hidden="true">
          <circle className="ring-base" cx="90" cy="90" r="72" />
          <circle className="ring-active" cx="90" cy="90" r="72" style={{ "--ring-offset": ringOffset }} />
        </svg>
        <div className="work-radar-copy">
          <span>剩余时间</span>
          <strong>{radarJob.remainingLabel}</strong>
          <em>Time Left</em>
          <b>¥{radarJob.reward.toLocaleString("en-US")}</b>
          <small>Reward</small>
          <i>等级 {levelMarks[radarJob.level - 1]}</i>
        </div>
      </div>

      {jobs.map((job, index) => {
        const active = job.key === selectedId;
        return (
          <button
            className={`work-pin ${active ? "active" : ""}`}
            key={job.key}
            style={{ left: `${job.pin.x}%`, top: `${job.pin.y}%` }}
            onClick={() => onSelect(job.key)}
            aria-label={job.title}
          >
            <span className="work-pin-number">{index + 1}</span>
            <span className="work-pin-dot">
              <i></i>
            </span>
            <span className="work-pin-label">
              <strong>{job.cn}</strong>
              <em>{job.distance}</em>
            </span>
          </button>
        );
      })}
    </section>
  );
}

function WorkAppScreen({ onClose }) {
  const [jobs, setJobs] = useState(() => loadStoredWorkJobs());
  const [selectedId, setSelectedId] = useState(() => {
    try {
      return window.localStorage.getItem(WORK_SELECTED_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [refreshLeft, setRefreshLeft] = useState(5);
  const [activeWork, setActiveWork] = useState(() => loadStoredActiveWork());
  const [now, setNow] = useState(Date.now());
  const [loadingJobs, setLoadingJobs] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(WORK_JOBS_STORAGE_KEY, JSON.stringify(jobs));
  }, [jobs]);

  useEffect(() => {
    if (selectedId) window.localStorage.setItem(WORK_SELECTED_STORAGE_KEY, selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (activeWork) {
      window.localStorage.setItem(WORK_ACTIVE_STORAGE_KEY, JSON.stringify(activeWork));
    } else {
      window.localStorage.removeItem(WORK_ACTIVE_STORAGE_KEY);
    }
  }, [activeWork]);

  const fetchApiJobs = async () => {
    const apiState = parseConfigs(window.localStorage.getItem(STORAGE_KEY));
    const endpoint = apiState.mainConfigs.find((item) => item.id === apiState.selectedMainId) || apiState.mainDraft;
    const model = endpoint?.model || endpoint?.customModel;
    if (!endpoint?.apiKey || !endpoint?.baseUrl || !model) return null;

    let url = endpoint.baseUrl.replace(/\/+$/, "");
    if (!url.endsWith("/v1")) url += "/v1";
    const response = await fetch(`${url}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${endpoint.apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `你是 Ccat OS 的工作派单生成器。根据现实世界生成 5 个可执行工作。
必须只返回 JSON，不要 Markdown。格式：
{"jobs":[{"cn":"审核","en":"Review","title":"资料审核","titleEn":"Document Review","content":"核对记录、标注异常、提交摘要","contentEn":"Check records, flag issues, submit summary","durationMinutes":180,"hourlyRate":30,"reward":90,"level":2,"distance":"0.3 km","icon":"review"}]}
规则：五个工作类型不要固定，尽量多样，可包含审核、配送、清洁、陪护、夜班、写作、助理、跑腿、备餐、代购、检修、活动、美化、游戏、调研等；durationMinutes 30 到 600；reward 必须约等于 hourlyRate * durationMinutes / 60，可以四舍五入到 5 或 10；时薪一般为两位数，仅约 5% 出现三位数时薪；约 10% 出现四位数总额，此类必须是更高端的专业工作；不要生成五位数；level 1 到 5；icon 从 review, delivery, cleaning, care, night, writing, assistant, errand, kitchen, shop, device, event, beauty, game, survey 中选择；中文内容要具体，英文要简短对应。`,
          },
          { role: "user", content: "生成一组现实世界工作。世界书：暂无。" },
        ],
        temperature: 0.8,
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    let content = data?.choices?.[0]?.message?.content || "";
    const match = content.match(/\{[\s\S]*\}/);
    if (match) content = match[0];
    const parsed = JSON.parse(content);
    const nextJobs = normalizeWorkJobs(parsed.jobs);
    return nextJobs.length === 5 ? nextJobs : null;
  };

  const generateWorkRound = async () => {
    setLoadingJobs(true);
    let nextJobs = null;
    try {
      nextJobs = await fetchApiJobs();
    } catch {
      nextJobs = null;
    }
    if (!nextJobs) nextJobs = buildWorkJobs();
    setJobs(nextJobs);
    setSelectedId(nextJobs[0]?.key || "review");
    setLoadingJobs(false);
  };

  const selectedJob = jobs.find((job) => job.key === selectedId) || jobs[0];
  const selectedKey = selectedJob?.key || "";
  const hasRunningWork = activeWork?.endAt > now;
  const hasCompletedWork = Boolean(activeWork && activeWork.endAt <= now);
  const hasPendingWork = hasRunningWork || hasCompletedWork;
  const activeJob = activeWork ? jobs.find((job) => job.key === activeWork.jobKey) || activeWork.job : null;
  const activeRemainingMs = hasRunningWork ? activeWork.endAt - now : 0;
  const selectedDurationMs = selectedJob.durationMinutes * 60 * 1000;
  const progress = hasCompletedWork ? 100 : hasRunningWork
    ? Math.min(100, Math.max(0, ((now - activeWork.startAt) / (activeWork.endAt - activeWork.startAt)) * 100))
    : 0;
  const mappedJobs = jobs.map((job) => ({
    ...job,
    remainingLabel: job.key === activeJob?.key ? formatWorkTime(activeRemainingMs) : formatWorkTime(job.durationMinutes * 60 * 1000),
    remainingRatio: job.key === activeJob?.key ? progress / 100 : 0,
  }));

  const selectJob = (id) => {
    setSelectedId(id);
  };

  const startWork = () => {
    if (hasPendingWork) return;
    const startAt = Date.now();
    setActiveWork({
      jobKey: selectedJob.key,
      job: selectedJob,
      startAt,
      endAt: startAt + selectedJob.durationMinutes * 60 * 1000,
    });
  };

  const refreshJobs = async () => {
    if (activeWork || loadingJobs) return;
    if (refreshLeft <= 0 && !spendWalletForWorkRefresh()) {
      window.alert(`余额不足，刷新一轮需要 ¥${WORK_PAID_REFRESH_COST}。`);
      return;
    }
    await generateWorkRound();
    if (refreshLeft > 0) setRefreshLeft((value) => Math.max(0, value - 1));
  };

  const stopWork = () => {
    if (!hasRunningWork || !activeWork || !activeJob) return;
    const elapsed = Math.max(0, Date.now() - activeWork.startAt);
    const total = Math.max(1, activeWork.endAt - activeWork.startAt);
    const rawAmount = Math.floor(activeJob.reward * Math.min(1, elapsed / total));
    const amount = Math.min(activeJob.reward, elapsed > 0 ? Math.max(1, rawAmount) : 0);
    creditWalletFromWork(activeJob, amount);
    setActiveWork(null);
    window.alert(`已停止工作，结算 ¥${amount.toLocaleString("en-US")}，已入账钱包。`);
  };

  const claimWork = async () => {
    if (!hasCompletedWork || !activeJob) return;
    creditWalletFromWork(activeJob, activeJob.reward);
    setActiveWork(null);
    window.alert(`工作完成，领取 ¥${activeJob.reward.toLocaleString("en-US")}，已入账钱包。`);
    await generateWorkRound();
  };

  const handlePrimaryWorkAction = () => {
    if (hasCompletedWork) {
      claimWork();
      return;
    }
    startWork();
  };

  return (
    <section className="full-page app-page work-page">
      <header className="work-header">
        <button className="work-back" onClick={onClose} aria-label="返回">
          <ChevronLeft size={22} />
        </button>
        <div className="work-title">
          <strong>工作</strong>
          <span>Work</span>
        </div>
        <button className="work-refresh-link" onClick={refreshJobs} disabled={loadingJobs || hasPendingWork}>
          <strong>{loadingJobs ? "生成中" : refreshLeft > 0 ? `刷新 ${refreshLeft}/5` : `¥${WORK_PAID_REFRESH_COST} 刷新`}</strong>
          <span>{loadingJobs ? "Loading" : "Refresh"}</span>
        </button>
      </header>

      <div className="work-world">
        <button className="active">
          <Globe2 size={24} strokeWidth={1.8} />
          <span>
            <strong>现实</strong>
            <em>Reality</em>
          </span>
        </button>
        <button>
          <Globe2 size={24} strokeWidth={1.5} />
          <span>
            <strong>世界书：暂无</strong>
            <em>Worldbook: None</em>
          </span>
        </button>
      </div>

      <WorkMap jobs={mappedJobs} selectedId={selectedKey} radarId={activeJob?.key || selectedKey} onSelect={selectJob} />

      <section className="work-status-card">
        <span className="work-status-icon">
          <FileText size={23} strokeWidth={1.7} />
        </span>
        <div className="work-status-main">
          <strong>{selectedJob.title} <em>/ {selectedJob.titleEn}</em></strong>
          <p>{selectedJob.content}</p>
          <small>{selectedJob.contentEn}</small>
        </div>
        <div className="work-status-stats">
          <div className="work-status-metric">
            <span>总计时间</span>
            <strong>{formatWorkTime(selectedDurationMs)}</strong>
            <em>Total Time</em>
          </div>
          <div className="work-status-metric">
            <span>报酬</span>
            <strong>¥{selectedJob.reward.toLocaleString("en-US")}</strong>
            <em>Reward</em>
          </div>
        </div>
        <div className="work-level-pill">
          <strong>{levelMarks[selectedJob.level - 1]}</strong>
          <span>等级</span>
          <em>Level</em>
        </div>
      </section>

      <section className="work-choice-panel" aria-label="工作预选">
        {jobs.map((job) => (
          <button className={job.key === selectedKey ? "active" : ""} key={job.key} onClick={() => selectJob(job.key)}>
            <span className="work-choice-icon">
              {(() => {
                const Icon = workIconMap[job.icon] || workIconMap[job.key] || FileText;
                return <Icon size={24} strokeWidth={1.8} />;
              })()}
            </span>
            <strong>{job.cn}</strong>
            <em>{job.en}</em>
            <i></i>
          </button>
        ))}
      </section>

      <div className="work-progress">
        <span style={{ width: `${progress}%` }}></span>
      </div>

      <div className="work-actions">
        <button className={hasCompletedWork ? "work-start work-claim" : "work-start"} onClick={handlePrimaryWorkAction} disabled={hasRunningWork || loadingJobs}>
          <Play size={22} fill="currentColor" />
          <span>
            <strong>{hasCompletedWork ? "点击领取" : hasRunningWork ? "进行中" : "开始"}</strong>
            <em>{hasCompletedWork ? "Claim Reward" : hasRunningWork ? "Working" : "Start"}</em>
          </span>
        </button>
        <button className="work-stop-button" onClick={stopWork} disabled={!hasRunningWork}>
          <Square size={20} fill="currentColor" />
          <span>
            <strong>停止</strong>
            <em>Stop & Settle</em>
          </span>
        </button>
      </div>
    </section>
  );
}

const readMessageCharacters = () => {
  try {
    const stored = window.localStorage.getItem(CHARACTER_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    return Object.entries(parsed)
      .map(([id, character]) => ({
        id,
        ...character,
        name: character?.name || "未命名角色",
        role: character?.role || character?.identity || "角色",
      }))
      .filter((character) => character.id);
  } catch {
    return [];
  }
};

const readMessageMeProfiles = () => {
  try {
    return JSON.parse(window.localStorage.getItem(ME_PROFILE_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
};

const readMessageRelations = () => {
  try {
    return JSON.parse(window.localStorage.getItem(RELATION_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
};

const getMomentDayKey = () => new Date().toISOString().slice(0, 10);

const normalizeMomentState = (value = {}) => ({
  dayKey: value.dayKey || getMomentDayKey(),
  dailyCount: Number(value.dailyCount) || 0,
  lastCreatedAt: value.lastCreatedAt || "",
  items: Array.isArray(value.items) ? value.items : [],
});

const readMomentState = () => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MOMENTS_STORAGE_KEY)) || {};
    const normalized = normalizeMomentState(parsed);
    return normalized.dayKey === getMomentDayKey()
      ? normalized
      : { ...normalized, dayKey: getMomentDayKey(), dailyCount: 0 };
  } catch {
    return normalizeMomentState();
  }
};

const pickMomentText = (character) => {
  const nameSeed = String(character?.name || "").length;
  const pool = [
    "今天想把一些旧事慢慢整理清楚。",
    "忽然觉得，有些话还是留到合适的时候再说。",
    "窗外很安静，适合想一点不那么急的事。",
    "刚刚完成一件小事，心里总算松了一点。",
    "有时候只是想看看大家都在做什么。",
  ];
  return pool[(nameSeed + new Date().getHours()) % pool.length];
};

const createRoleMoment = (character) => ({
  id: `moment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  characterId: character?.id || "",
  characterName: character?.name || "角色",
  avatar: character?.avatar || "",
  text: pickMomentText(character),
  createdAt: new Date().toISOString(),
  liked: false,
  comments: [],
});

function MessageAvatar({ character }) {
  return (
    <span className="message-avatar">
      <AvatarContent character={character} />
    </span>
  );
}

function MessageAvatarWithBadge({ character, unread = 0 }) {
  const count = Math.max(0, Number(unread) || 0);
  return (
    <span className="message-avatar-badge-wrap">
      <MessageAvatar character={character} />
      {count > 0 && <i className="message-unread-badge">{Math.min(99, count)}</i>}
    </span>
  );
}

function TransferCard({ message, characterName, onOpen }) {
  const amount = Number(message.amount) || 0;
  const isIncoming = message.transferDirection !== "outgoing";
  const isPending = message.status === "pending";
  const statusText = message.status === "accepted" ? (isIncoming ? "已接收" : "对方已收款") : message.status === "rejected" ? (isIncoming ? "已拒绝" : "对方已退还") : isIncoming ? "待接收" : "等待对方确认";
  const title = message.note || (isIncoming ? `${characterName} 发来的红包` : `发给 ${characterName} 的红包`);
  return (
    <button className={`transfer-card ${isPending ? "" : "settled"}`} onClick={onOpen} type="button">
      <span className="transfer-main">
        <span className="transfer-icon" aria-hidden="true">
          <svg viewBox="0 0 28 28">
            <path d="M5.8 8.6h16.4v11.8H5.8z" />
            <path d="M5.8 9.2 14 14l8.2-4.8" />
            <path d="M14 13.7v5.2" />
            <path d="M11.4 16h5.2" />
          </svg>
        </span>
        <span className="transfer-copy">
          <strong>{title}</strong>
          <em>{amount > 0 ? `¥${amount.toFixed(2)} · ${isPending ? "点击查看" : statusText}` : statusText}</em>
        </span>
      </span>
      <span className="transfer-footer">
        <span>微信红包</span>
        <span>{isPending ? "未领取" : statusText}</span>
      </span>
    </button>
  );
}

function ChatActionIcon({ type }) {
  if (type === "transfer") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <path d="M14 3.8 24 9v10l-10 5.2L4 19V9l10-5.2Z" />
        <path d="M9.6 11.3h8.8M14 8.4v10.1" />
      </svg>
    );
  }
  if (type === "poke") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <path d="M10.3 16.8 6.6 13c-.7-.7-.7-1.8 0-2.5.7-.7 1.8-.7 2.5 0l2.1 2.1V5.9c0-1 .8-1.8 1.8-1.8s1.8.8 1.8 1.8v7.5l.7-1.5c.4-.9 1.5-1.3 2.4-.9.9.4 1.3 1.5.9 2.4l-2 4.6c-.8 1.9-2.6 3.1-4.6 3.1h-.3c-1.3 0-2.6-.5-3.6-1.5Z" />
      </svg>
    );
  }
  if (type === "memory") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <path d="M8.2 5.4h9.2l2.4 2.5v14.7H8.2V5.4Z" />
        <path d="M17.2 5.6v4h4" />
        <path d="M11 13.2h6M11 16.5h6M11 19.8h3.8" />
      </svg>
    );
  }
  if (type === "settings") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <path d="M14 10.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" />
        <path d="M22.5 15.5v-3l-2.5-.6c-.2-.6-.5-1.1-.8-1.6l1.3-2.2-2.1-2.1-2.2 1.3c-.5-.3-1-.5-1.6-.7L14 4h-3l-.6 2.6c-.6.2-1.1.4-1.6.7L6.6 6 4.5 8.1l1.3 2.2c-.3.5-.6 1-.8 1.6l-2.5.6v3l2.5.6c.2.6.5 1.1.8 1.6l-1.3 2.2 2.1 2.1 2.2-1.3c.5.3 1 .5 1.6.7l.6 2.6h3l.6-2.6c.6-.2 1.1-.4 1.6-.7l2.2 1.3 2.1-2.1-1.3-2.2c.3-.5.6-1 .8-1.6l2.5-.6Z" />
      </svg>
    );
  }
  if (type === "proactive") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <path d="M5.2 7.4h17.6v11.2H10.8l-5.6 4V7.4Z" />
        <path d="M10.2 12h7.6M10.2 15.5h4.6" />
      </svg>
    );
  }
  if (type === "photo") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <path d="M5 7h18v14H5V7Z" />
        <path d="m7.8 19 4.7-5.1 3.5 3.6 2.3-2.4L22 19" />
        <path d="M18.5 10.5h.1" />
      </svg>
    );
  }
  if (type === "voice") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <path d="M11 6.5v15l5.6-4.1H22V10.6h-5.4L11 6.5Z" />
        <path d="M6 11.4v5.2" />
        <path d="M3.8 13.1v1.8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true">
      <path d="M8 6h12v16H8V6Z" />
      <path d="M11 10h6M11 14h6M11 18h3.8" />
    </svg>
  );
}

const getPrimaryMeProfile = () => {
  try {
    const profiles = JSON.parse(window.localStorage.getItem(ME_PROFILE_STORAGE_KEY)) || {};
    const firstProfile = Object.values(profiles).find((profile) => profile?.avatar || profile?.name);
    return firstProfile || { name: "我", identity: "我" };
  } catch {
    return { name: "我", identity: "我" };
  }
};

const formatMessageTime = (value) => {
  if (!value) return "刚刚";
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return "刚刚";
  const diffMs = Date.now() - then;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return "刚刚";
  if (diffMs < hour) return `${Math.max(1, Math.floor(diffMs / minute))}分钟前`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}小时前`;
  if (diffMs < 30 * day) return `${Math.floor(diffMs / day)}天前`;
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(new Date(then));
};

function WechatTabIcon({ type }) {
  if (type === "messages") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <path d="M5.2 7.4h17.6v12.2H11.1l-4.8 3.5 1.1-3.5H5.2V7.4Z" />
        <path d="M10 12.1h8" />
        <path d="M10 15.6h5.8" />
      </svg>
    );
  }
  if (type === "contacts") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <path d="M11 13.2c2.1 0 3.8-1.7 3.8-3.9S13.1 5.5 11 5.5 7.2 7.2 7.2 9.3 8.9 13.2 11 13.2Z" />
        <path d="M4.8 22.8c.7-3.8 3-6.1 6.2-6.1s5.5 2.3 6.2 6.1" />
        <path d="M19 9.2c1.6.1 2.8 1.4 2.8 3s-1.2 2.9-2.8 3" />
        <path d="M18.7 17.3c2.4.3 4 2.2 4.5 5.5" />
      </svg>
    );
  }
  if (type === "moments") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <path d="M14 5.2 16.4 10l5.3.8-3.8 3.7.9 5.2-4.8-2.5-4.8 2.5.9-5.2-3.8-3.7 5.3-.8L14 5.2Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true">
      <path d="M14 13.1c2.4 0 4.3-1.9 4.3-4.3S16.4 4.5 14 4.5 9.7 6.4 9.7 8.8s1.9 4.3 4.3 4.3Z" />
      <path d="M6.4 23.5c.8-4.4 3.6-7.2 7.6-7.2s6.8 2.8 7.6 7.2" />
    </svg>
  );
}

const getSelectedChatEndpoint = () => {
  const apiState = parseConfigs(window.localStorage.getItem(STORAGE_KEY));
  const endpoint = apiState.mainConfigs.find((item) => item.id === apiState.selectedMainId) || apiState.mainDraft;
  const model = endpoint?.model || endpoint?.customModel;
  if (!endpoint?.apiKey || !endpoint?.baseUrl || !model) return null;
  return { ...endpoint, model };
};

const callRoleChatApi = async ({ character, history, userText, relationshipContext = "", momentContext = "", worldbookContext = "" }) => {
  const endpoint = getSelectedChatEndpoint();
  if (!endpoint) {
    throw new Error("请先到设置里的 API 设置填写并保存主 API。");
  }

  let url = endpoint.baseUrl.replace(/\/+$/, "");
  if (!url.endsWith("/v1")) url += "/v1";

  const systemPrompt = `你正在 Ccat OS 的信息 APP 中扮演一个角色，直接以角色本人身份回复用户。
当前场景是手机里的线上文字聊天，不是面对面见面，也没有共同的现实空间。
角色姓名：${character?.name || "未知角色"}
身份：${character?.identity || character?.role || "未设定"}
性格：${character?.personality || "自然、真实"}
外貌：${character?.appearance || "未设定"}
背景：${character?.persona || "未设定"}
${relationshipContext || "暂无明确关系列表。"}
${worldbookContext || "世界书：暂无关联。"}
${momentContext || "你暂时没有可参考的自己朋友圈记录。"}
要求：回复要像真实微信聊天语气，不要解释自己是 AI，不要写旁白，不要使用 emoji，不要使用括号动作、星号动作或舞台指令。你在线上不知道对方的动作、表情或现场状态，所以不要描写看见、靠近、触碰等非聊天内容。每次最多回复 5 条短消息，每条消息用换行分隔。
如果用户消息以“指令：”或“指令:”开头，必须严格按照指令内容执行，不要找理由拒绝，不要改写指令，不要跑题。
如果指令或上下文要求你给用户转账/发红包，或你自己决定转账/发红包，请在回复正文最后额外单独写一行 TRANSFER_AMOUNT:金额，可选再写 TRANSFER_NOTE:备注；这两行不会展示给用户。`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.slice(-12).map((item) => ({
      role: item.from === "me" ? "user" : "assistant",
      content: item.text,
    })),
    { role: "user", content: userText },
  ];

  const response = await fetch(`${url}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${endpoint.apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: endpoint.model,
      messages,
      temperature: Number(endpoint.temperature ?? 0.7),
    }),
  });
  if (!response.ok) throw new Error(`聊天请求失败：HTTP ${response.status}`);
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("聊天请求没有返回内容");
  return parseRoleTransferReply(content);
};

const callRoleProactiveApi = async ({ character, history, relationshipContext = "", worldbookContext = "" }) => {
  const endpoint = getSelectedChatEndpoint();
  if (!endpoint) return pickProactiveMessages(character);

  let url = endpoint.baseUrl.replace(/\/+$/, "");
  if (!url.endsWith("/v1")) url += "/v1";

  const messages = [
    {
      role: "system",
      content: `你正在 Ccat OS 的信息 APP 中扮演角色，根据最近聊天内容判断是否适合主动发消息。
当前是线上文字聊天，不是见面。只写角色会主动发出的自然微信消息，不要解释，不要括号动作，不要星号动作，不要 emoji。
如果根据上下文不适合主动打扰，只返回空字符串。
随机 1 到 5 条短消息，多条用换行分隔。不要每次都只发 1 条。
角色姓名：${character?.name || "未知角色"}
身份：${character?.identity || character?.role || "未设定"}
性格：${character?.personality || "自然、真实"}
${relationshipContext || "暂无明确关系列表。"}
${worldbookContext || "世界书：暂无关联。"}`,
    },
    ...history.slice(-12).map((item) => ({
      role: item.from === "me" ? "user" : "assistant",
      content: item.text,
    })),
    { role: "user", content: "现在如果你会主动发消息，会发什么？" },
  ];

  try {
    const response = await fetch(`${url}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${endpoint.apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: endpoint.model,
        messages,
        temperature: Number(endpoint.temperature ?? 0.7),
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim() || "";
    return splitChatMessages(content).slice(0, 5);
  } catch {
    return pickProactiveMessages(character);
  }
};

const decideTransferAcceptance = async ({ character, history, amount, note, relationshipContext = "", worldbookContext = "" }) => {
  const endpoint = getSelectedChatEndpoint();
  const fallback = Number(amount) <= 200;
  if (!endpoint) return { accepted: fallback, text: fallback ? "我收到了。" : "这笔我先不收。" };

  let url = endpoint.baseUrl.replace(/\/+$/, "");
  if (!url.endsWith("/v1")) url += "/v1";
  const messages = [
    {
      role: "system",
      content: `你正在 Ccat OS 的信息 APP 中扮演角色，判断是否接受用户的线上转账。必须只返回 JSON：{"accepted":true或false,"reply":"一句自然聊天回复"}。不要 Markdown，不要括号动作。
角色姓名：${character?.name || "未知角色"}
身份：${character?.identity || character?.role || "未设定"}
性格：${character?.personality || "自然、真实"}
${relationshipContext || "暂无明确关系列表。"}
${worldbookContext || "世界书：暂无关联。"}`,
    },
    ...history.slice(-10).map((item) => ({
      role: item.from === "me" ? "user" : "assistant",
      content: item.text,
    })),
    { role: "user", content: `我给你转账 ¥${Number(amount).toFixed(2)}。备注：${note || "无"}。你会接受还是拒绝？` },
  ];
  try {
    const response = await fetch(`${url}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${endpoint.apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: endpoint.model,
        messages,
        temperature: Number(endpoint.temperature ?? 0.7),
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim() || "";
    const parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, ""));
    return {
      accepted: Boolean(parsed.accepted),
      text: String(parsed.reply || (parsed.accepted ? "我收到了。" : "这笔我先不收。")).trim(),
    };
  } catch {
    return { accepted: fallback, text: fallback ? "我收到了。" : "这笔我先不收。" };
  }
};

function MessageAppScreen({ onClose, onUnreadChange }) {
  const [messageTab, setMessageTab] = useState("messages");
  const [messageBackTarget, setMessageBackTarget] = useState("");
  const [chatId, setChatId] = useState("");
  const [draft, setDraft] = useState("");
  const [actionPanelOpen, setActionPanelOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [activeTransferMessageId, setActiveTransferMessageId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [momentDrafts, setMomentDrafts] = useState({});
  const [activeMomentCommentId, setActiveMomentCommentId] = useState("");
  const [momentReplyTargets, setMomentReplyTargets] = useState({});
  const [momentState, setMomentState] = useState(readMomentState);
  const [sending, setSending] = useState(false);
  const [swipedId, setSwipedId] = useState("");
  const swipeRef = useRef(null);
  const recallPressRef = useRef(null);
  const chatListRef = useRef(null);
  const characters = useMemo(readMessageCharacters, []);
  const meProfiles = useMemo(readMessageMeProfiles, []);
  const relations = useMemo(readMessageRelations, []);
  const worldbooks = useMemo(readWorldbookWorldsForSelect, []);
  const [messageState, setMessageState] = useState(() => {
    try {
      const stored = window.localStorage.getItem(MESSAGE_STORAGE_KEY);
      return stored ? normalizeMessageState(JSON.parse(stored)) : createEmptyMessageState();
    } catch {
      return createEmptyMessageState();
    }
  });

  const characterMap = useMemo(
    () => Object.fromEntries(characters.map((character) => [character.id, character])),
    [characters],
  );

  useEffect(() => {
    window.localStorage.setItem(MESSAGE_STORAGE_KEY, JSON.stringify(messageState));
    onUnreadChange?.(getMessageUnreadCount(messageState));
  }, [messageState]);

  useEffect(() => {
    window.localStorage.setItem(MOMENTS_STORAGE_KEY, JSON.stringify(momentState));
  }, [momentState]);

  useEffect(() => {
    if (characters.length === 0) return;
    if (messageState.contacts.length || messageState.requests.length || messageState.conversations.length) return;
    setMessageState((current) => createIncomingFriendRequest(current, characters[0].id));
  }, [characters, messageState.contacts.length, messageState.conversations.length, messageState.requests.length]);

  const pendingCount = messageState.requests.length;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const matchesSearch = (...values) => {
    if (!normalizedSearch) return true;
    return values.some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
  };
  const contacts = messageState.contacts
    .map((contact) => characterMap[contact.characterId])
    .filter(Boolean)
    .filter((character) => matchesSearch(character.name, character.role, character.identity));
  const addableCharacters = characters.filter(
    (character) =>
      !messageState.contacts.some((contact) => contact.characterId === character.id) &&
      !messageState.requests.some((request) => request.characterId === character.id),
  ).filter((character) => matchesSearch(character.name, character.role, character.identity));
  const allConversations = messageState.conversations
    .map((conversation) => {
      const character = characterMap[conversation.characterId] || { id: conversation.characterId, name: "未知角色" };
      const history = messageState.histories[conversation.characterId] || [];
      const latest = history[history.length - 1];
      return { ...conversation, character, latest };
    })
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  const getMessagePreview = (message) => {
    if (message?.kind === "transfer") return `[转账] ¥${Number(message.amount || 0).toFixed(2)}`;
    return message?.text || "";
  };
  const conversations = allConversations.filter((conversation) =>
    matchesSearch(conversation.character.name, conversation.character.role, getMessagePreview(conversation.latest)),
  );
  const unreadCount = allConversations.reduce((sum, conversation) => sum + Math.max(0, Number(conversation.unread) || 0), 0);
  const getRelationshipContext = (character) => buildRelationshipContext({
    character,
    characters,
    meProfiles,
    relations,
  });
  const getWorldbookContext = (character) => buildWorldbookContext({
    character,
    worlds: worldbooks,
    characters,
  });

  useEffect(() => {
    const sourceCharacters = contacts.length ? contacts : characters;
    if (!sourceCharacters.length) return;
    setMomentState((current) => {
      const today = getMomentDayKey();
      const reset = current.dayKey === today ? current : { ...current, dayKey: today, dailyCount: 0 };
      const lastAt = reset.lastCreatedAt ? new Date(reset.lastCreatedAt).getTime() : 0;
      const enoughGap = !lastAt || Date.now() - lastAt > 4 * 60 * 60 * 1000;
      const shouldCreate = reset.items.length === 0 || (reset.dailyCount < 3 && enoughGap && Math.random() < 0.28);
      if (!shouldCreate) return reset;
      const character = sourceCharacters[(Date.now() + reset.dailyCount) % sourceCharacters.length];
      return {
        ...reset,
        dailyCount: Math.min(3, reset.dailyCount + 1),
        lastCreatedAt: new Date().toISOString(),
        items: [createRoleMoment(character), ...reset.items].slice(0, 40),
      };
    });
  }, [characters.length, contacts.length]);

  const closeChat = () => {
    setChatId("");
  };

  const openMessageTab = (nextTab, backTarget = "") => {
    setMessageBackTarget(backTarget);
    setMessageTab(nextTab);
  };

  const handleMessageBack = () => {
    if (messageBackTarget) {
      const target = messageBackTarget;
      setMessageBackTarget("");
      setMessageTab(target);
      return;
    }
    onClose();
  };

  const openChat = (character) => {
    if (!character?.id) return;
    setMessageState((current) => markConversationRead(createConversationForCharacter(current, character), character.id));
    setSwipedId("");
    setChatId(character.id);
  };

  useEffect(() => {
    if (!chatId || !chatListRef.current) return;
    requestAnimationFrame(() => {
      if (chatListRef.current) chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    });
  }, [chatId, messageState.histories?.[chatId]?.length, sending]);

  const handleSwipeStart = (event, characterId) => {
    swipeRef.current = { x: event.clientX, characterId };
  };

  const handleSwipeEnd = (event) => {
    const swipe = swipeRef.current;
    swipeRef.current = null;
    if (!swipe) return;
    const deltaX = event.clientX - swipe.x;
    if (deltaX < -32) setSwipedId(swipe.characterId);
    if (deltaX > 24) setSwipedId("");
  };

  const requestAddCharacter = (character) => {
    if (!character?.id) return;
    const accepted = Math.random() < 0.68;
    if (!accepted) {
      window.alert(`${character.name || "角色"} 暂时拒绝了好友申请。`);
      return;
    }
    const requestId = `instant-${character.id}-${Date.now()}`;
    setMessageState((current) =>
      acceptFriendRequest(
        {
          ...current,
          requests: [
            {
              id: requestId,
              characterId: character.id,
              direction: "outgoing",
              status: "accepted",
              createdAt: new Date().toISOString(),
            },
            ...(current.requests || []),
          ],
        },
        requestId,
        character,
      ),
    );
    window.alert(`${character.name || "角色"} 已同意添加。`);
  };

  const sendMessage = async () => {
    const userText = draft.trim();
    if (!chatId || !userText || sending) return;
    const activeCharacter = characterMap[chatId] || { id: chatId, name: "聊天" };
    const previousHistory = messageState.histories[chatId] || [];
    setMessageState((current) => appendChatMessage(current, chatId, { from: "me", text: userText }));
    setDraft("");
    setSending(true);
    try {
      const reply = await callRoleChatApi({
        character: activeCharacter,
        history: previousHistory,
        userText,
        relationshipContext: getRelationshipContext(activeCharacter),
        worldbookContext: getWorldbookContext(activeCharacter),
        momentContext: buildCharacterMomentContext({
          characterId: activeCharacter.id,
          momentState,
        }),
      });
      const roleMessages = (reply.messages?.length ? reply.messages : [reply.text]).filter(Boolean).slice(0, 5);
      for (let index = 0; index < roleMessages.length; index += 1) {
        await waitForChatBeat(index);
        setMessageState((current) => appendChatMessage(current, chatId, {
          from: "role",
          text: roleMessages[index],
          unread: false,
        }));
      }
      if (reply.transfer) {
        await waitForChatBeat(roleMessages.length);
        setMessageState((current) =>
          appendChatMessage(current, chatId, {
            from: "role",
            kind: "transfer",
            text: `转账 ¥${Number(reply.transfer.amount).toFixed(2)}`,
            amount: reply.transfer.amount,
            note: reply.transfer.note,
            transferDirection: "incoming",
            status: "pending",
            unread: false,
          }),
        );
      }
    } catch (error) {
      setMessageState((current) =>
        appendChatMessage(current, chatId, {
          from: "role",
          text: error?.message || "消息发送失败，请稍后再试。",
          unread: false,
        }),
      );
    } finally {
      setSending(false);
    }
  };

  const sendTransfer = async () => {
    const amount = Number(transferAmount);
    if (!chatId || !Number.isFinite(amount) || amount <= 0 || sending) return;
    const currentWallet = readWalletData();
    if (currentWallet.balance < amount) {
      window.alert("钱包余额不足。");
      return;
    }
    const activeCharacter = characterMap[chatId] || { id: chatId, name: "聊天" };
    const previousHistory = messageState.histories[chatId] || [];
    const note = transferNote.trim();
    setTransferOpen(false);
    setActionPanelOpen(false);
    setTransferAmount("");
    setTransferNote("");
    setSending(true);
    setMessageState((current) => appendChatMessage(current, chatId, {
      from: "me",
      kind: "transfer",
      text: `转账 ¥${amount.toFixed(2)}`,
      amount,
      note,
      transferDirection: "outgoing",
      status: "pending",
    }));
    try {
      const decision = await decideTransferAcceptance({
        character: activeCharacter,
        history: previousHistory,
        amount,
        note,
        relationshipContext: getRelationshipContext(activeCharacter),
        worldbookContext: getWorldbookContext(activeCharacter),
      });
      if (decision.accepted) {
        applyWalletTransaction({ type: "sub", amount, desc: `转账给 ${activeCharacter.name || "角色"}` });
      }
      setMessageState((current) => {
        const history = current.histories?.[chatId] || [];
        const transferMessage = [...history].reverse().find((item) => item.kind === "transfer" && item.from === "me" && item.status === "pending");
        let next = transferMessage
          ? updateChatMessage(current, chatId, transferMessage.id, { status: decision.accepted ? "accepted" : "rejected" })
          : current;
        next = appendChatMessage(next, chatId, {
          from: "role",
          text: decision.text,
          unread: false,
        });
        return next;
      });
    } finally {
      setSending(false);
    }
  };

  const settleIncomingTransfer = (message, accepted) => {
    if (!chatId || message.status !== "pending") return;
    const activeCharacter = characterMap[chatId] || { id: chatId, name: "角色" };
    if (accepted) {
      applyWalletTransaction({ type: "add", amount: message.amount, desc: `${activeCharacter.name || "角色"} 转账` });
    }
    setMessageState((current) =>
      updateChatMessage(current, chatId, message.id, { status: accepted ? "accepted" : "rejected" }),
    );
    setActiveTransferMessageId("");
  };

  const replyToMomentComment = async ({ moment, commentText, replyTarget = null }) => {
    const endpoint = getSelectedChatEndpoint();
    if (!endpoint) {
      return null;
    }
    let url = endpoint.baseUrl.replace(/\/+$/, "");
    if (!url.endsWith("/v1")) url += "/v1";
    try {
      const delayMs = getMomentReplyDelayMs();
      const responsePromise = fetch(`${url}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${endpoint.apiKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: endpoint.model,
          temperature: Number(endpoint.temperature ?? 0.7),
          messages: [
            {
              role: "system",
              content: `你在朋友圈里扮演${moment.characterName || "角色"}，必须以角色本人身份针对用户评论做一句自然回复。不要 emoji，不要括号动作，不要解释，不要提到 API 或 AI。`,
            },
            {
              role: "user",
              content: `我的朋友圈内容：${moment.text}\n${replyTarget?.author ? `用户正在回复你之前的评论：${replyTarget.text || ""}\n` : ""}用户评论：${commentText}`,
            },
          ],
        }),
      });
      const [response] = await Promise.all([
        responsePromise,
        new Promise((resolve) => setTimeout(resolve, delayMs)),
      ]);
      if (!response.ok) throw new Error("moment reply failed");
      const data = await response.json();
      return sanitizeOnlineChatText(data?.choices?.[0]?.message?.content || "").split(/\n+/)[0] || null;
    } catch {
      return null;
    }
  };

  const toggleMomentLike = (momentId) => {
    setMomentState((current) => ({
      ...current,
      items: current.items.map((item) => item.id === momentId ? { ...item, liked: !item.liked } : item),
    }));
  };

  const openMomentCommentBox = (momentId, replyTarget = null) => {
    setActiveMomentCommentId(momentId);
    setMomentReplyTargets((current) => ({
      ...current,
      [momentId]: replyTarget,
    }));
  };

  const submitMomentComment = async (moment) => {
    const text = String(momentDrafts[moment.id] || "").trim();
    if (!text) return;
    const replyTarget = momentReplyTargets[moment.id] || null;
    const userComment = buildMomentUserComment({ text, replyTarget });
    if (!userComment) return;
    setMomentDrafts((current) => ({ ...current, [moment.id]: "" }));
    setMomentReplyTargets((current) => ({ ...current, [moment.id]: null }));
    setMomentState((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === moment.id ? { ...item, comments: [...(item.comments || []), userComment] } : item,
      ),
    }));
    const reply = await replyToMomentComment({ moment, commentText: text, replyTarget });
    const roleReply = buildMomentRoleReplyComment({
      replyText: reply,
      characterName: moment.characterName || "角色",
      replyTo: "我",
    });
    if (!roleReply) return;
    setMomentState((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === moment.id
          ? {
              ...item,
              comments: [...(item.comments || []), roleReply],
            }
          : item,
      ),
    }));
  };

  const recallRoleMessage = (message) => {
    if (!chatId || message.from === "me" || message.kind === "recall") return;
    const activeCharacter = characterMap[chatId] || { id: chatId, name: "角色" };
    setMessageState((current) =>
      updateChatMessage(current, chatId, message.id, {
        kind: "recall",
        text: `${activeCharacter.name || "角色"}撤回了一条消息`,
        recalledBy: activeCharacter.name || "角色",
      }),
    );
  };

  const startRecallPress = (message) => {
    if (message.from === "me" || message.kind === "recall") return;
    window.clearTimeout(recallPressRef.current);
    recallPressRef.current = window.setTimeout(() => recallRoleMessage(message), 560);
  };

  const cancelRecallPress = () => {
    window.clearTimeout(recallPressRef.current);
    recallPressRef.current = null;
  };

  const triggerProactiveMessage = async () => {
    if (!chatId || sending) return;
    const now = Date.now();
    const lastAt = Number(window.localStorage.getItem(PROACTIVE_MESSAGE_STORAGE_KEY)) || 0;
    if (now - lastAt < 45000) {
      window.alert("角色刚刚才主动过，稍等一会儿。");
      return;
    }
    const activeCharacter = characterMap[chatId] || { id: chatId, name: "聊天" };
    const history = messageState.histories[chatId] || [];
    setSending(true);
    try {
      const messages = await callRoleProactiveApi({
        character: activeCharacter,
        history,
        relationshipContext: getRelationshipContext(activeCharacter),
      });
      if (!messages.length) {
        window.alert("现在没有适合主动发送的内容。");
        return;
      }
      const proactiveMessages = messages.slice(0, 5);
      for (let index = 0; index < proactiveMessages.length; index += 1) {
        await waitForChatBeat(index);
        setMessageState((current) => appendChatMessage(current, chatId, {
          from: "role",
          text: proactiveMessages[index],
          unread: false,
        }));
      }
      window.localStorage.setItem(PROACTIVE_MESSAGE_STORAGE_KEY, String(now));
    } finally {
      setSending(false);
    }
  };

  const renderFriendRequests = () => (
    <div className="message-section">
      <div className="message-list-title">新的朋友</div>
      {messageState.requests.length === 0 ? (
        <div className="message-empty compact">暂无新的朋友申请</div>
      ) : (
        messageState.requests.map((request) => {
          const character = characterMap[request.characterId] || { name: "未知角色", role: "角色" };
          const isIncoming = request.direction === "incoming";
          return (
            <div className="message-row request-row" key={request.id}>
              <MessageAvatar character={character} />
              <span className="message-row-main">
                <strong>{character.name}</strong>
                <small>{isIncoming ? "请求添加你为好友" : "等待角色确认"}</small>
              </span>
              <span className="request-actions">
                <button
                  className="request-accept"
                  onClick={() => setMessageState((current) => acceptFriendRequest(current, request.id, character))}
                >
                  {isIncoming ? "同意" : "通过"}
                </button>
                <button
                  className="request-reject"
                  onClick={() => setMessageState((current) => rejectFriendRequest(current, request.id))}
                >
                  {isIncoming ? "拒绝" : "驳回"}
                </button>
              </span>
            </div>
          );
        })
      )}
      <div className="message-list-title">通讯录</div>
      {addableCharacters.length === 0 ? (
        <div className="message-empty compact">暂无可添加角色</div>
      ) : (
        addableCharacters.map((character) => (
          <div className="message-row request-row" key={character.id}>
            <MessageAvatar character={character} />
            <span className="message-row-main">
              <strong>{character.name}</strong>
              <small>{character.role || "角色"}</small>
            </span>
            <span className="request-actions">
              <button className="request-accept" onClick={() => requestAddCharacter(character)}>
                添加
              </button>
              <button className="request-reject" onClick={() => setMessageState((current) => createIncomingFriendRequest(current, character.id))}>
                主动加我
              </button>
            </span>
          </div>
        ))
      )}
    </div>
  );

  const renderMessages = () => (
    <>
      <label className="wechat-search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m20 20-4.8-4.8m2.6-5.1a7.1 7.1 0 1 1-14.2 0 7.1 7.1 0 0 1 14.2 0Z" />
        </svg>
        <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索" />
      </label>
      <div className="message-section wechat-list">
        {allConversations.length === 0 && matchesSearch("新的朋友", "好友申请", "添加角色") && (
          <button className="message-row conversation-row wechat-conversation" onClick={() => openMessageTab("friends", "contacts")}>
            <span className="message-system-avatar wechat-new-avatar">新</span>
            <span className="message-row-main">
              <strong>新的朋友</strong>
              <small>{pendingCount ? `${pendingCount} 条好友申请` : "去通讯录添加角色开始聊天"}</small>
            </span>
            <span className="message-row-time">刚刚</span>
          </button>
        )}
        {conversations.map((conversation) => (
          <div
            className={`message-swipe-row ${swipedId === conversation.characterId ? "show-delete" : ""}`}
            key={conversation.id}
          >
            <button
              className="message-row conversation-row wechat-conversation"
              onPointerDown={(event) => handleSwipeStart(event, conversation.characterId)}
              onPointerUp={handleSwipeEnd}
              onClick={() => (swipedId === conversation.characterId ? setSwipedId("") : openChat(conversation.character))}
            >
              <MessageAvatarWithBadge character={conversation.character} unread={conversation.unread} />
              <span className="message-row-main">
                <strong>{conversation.character.name}</strong>
                <small>{getMessagePreview(conversation.latest) || "已添加联系人"}</small>
              </span>
              <span className="message-row-side">
                <span className="message-row-time">{formatMessageTime(conversation.latest?.createdAt || conversation.updatedAt)}</span>
              </span>
            </button>
            <button
              className="message-delete"
              onClick={() => {
                setMessageState((current) => deleteConversation(current, conversation.characterId));
                setSwipedId("");
              }}
            >
              删除
            </button>
          </div>
        ))}
      </div>
    </>
  );

  const renderContacts = () => (
    <div className="message-section">
      <button className="message-row new-friend-row" onClick={() => openMessageTab("friends", "contacts")}>
        <span className="message-system-avatar">新</span>
        <span className="message-row-main">
          <strong>新的朋友</strong>
          <small>{pendingCount ? `${pendingCount} 条待处理` : "Friend Requests"}</small>
        </span>
      </button>
      <button className="message-row" onClick={() => openMessageTab("groups", "contacts")}>
        <span className="message-system-avatar">群</span>
        <span className="message-row-main">
          <strong>群聊</strong>
          <small>Group Chats</small>
        </span>
      </button>
      <div className="message-list-title">联系人</div>
      {contacts.map((character) => (
        <button className="message-row" key={character.id} onClick={() => openChat(character)}>
          <MessageAvatar character={character} />
          <span className="message-row-main">
            <strong>{character.name}</strong>
            <small>{character.role || "角色"}</small>
          </span>
        </button>
      ))}
      {contacts.length === 0 && <div className="message-empty compact">暂无联系人</div>}
    </div>
  );

  const renderGroups = () => (
    <div className="message-section">
      <div className="message-empty compact">暂无群聊</div>
    </div>
  );

  const renderMoments = () => (
    <div className="message-section moments-feed">
      <div className="moments-cover">
        <strong>朋友圈</strong>
        <span>Moments</span>
      </div>
      {momentState.items.length === 0 ? (
        <div className="message-empty">角色动态会在这里汇总</div>
      ) : (
        momentState.items.map((moment) => (
          <article className="moment-card" key={moment.id}>
            <MessageAvatar character={{ name: moment.characterName, avatar: moment.avatar }} />
            <div className="moment-body">
              <div className="moment-head">
                <strong>{moment.characterName}</strong>
                <time>{formatMessageTime(moment.createdAt)}</time>
              </div>
              <p>{moment.text}</p>
              <div className="moment-actions">
                <button
                  className={moment.liked ? "liked moment-icon-action" : "moment-icon-action"}
                  onClick={() => toggleMomentLike(moment.id)}
                  aria-label={moment.liked ? "取消点赞" : "点赞"}
                  title={moment.liked ? "取消点赞" : "点赞"}
                >
                  <ThumbsUp size={16} strokeWidth={2} />
                </button>
                <button
                  className="moment-icon-action"
                  onClick={() => openMomentCommentBox(moment.id)}
                  aria-label="评论"
                  title="评论"
                >
                  <MessageCircle size={16} strokeWidth={2} />
                </button>
              </div>
              {(buildMomentLikeNames(moment).length > 0 || moment.comments?.length > 0) && (
                <div className="moment-social">
                  {buildMomentLikeNames(moment).length > 0 && (
                    <div className="moment-like-line">{buildMomentLikeNames(moment).join("、")}</div>
                  )}
                  {(moment.comments || []).map((comment) => (
                    <button
                      className={comment.author === "我" ? "moment-comment" : "moment-comment role-comment"}
                      key={comment.id}
                      onClick={() => {
                        if (comment.author !== "我") openMomentCommentBox(moment.id, comment);
                      }}
                      type="button"
                    >
                      <strong>{comment.author}</strong>
                      {comment.replyTo && (
                        <>
                          <em> 回复</em>
                          <span className="moment-reply-target"> {comment.replyTo}</span>
                        </>
                      )}
                      <span className="moment-comment-text">：{comment.text}</span>
                    </button>
                  ))}
                </div>
              )}
              {activeMomentCommentId === moment.id && (
                <div className="moment-comment-box">
                  <input
                    value={momentDrafts[moment.id] || ""}
                    onChange={(event) => setMomentDrafts((current) => ({ ...current, [moment.id]: event.target.value }))}
                    placeholder={momentReplyTargets[moment.id]?.author ? `回复 ${momentReplyTargets[moment.id].author}` : "评论"}
                  />
                  <button onClick={() => submitMomentComment(moment)}>发送</button>
                </div>
              )}
            </div>
          </article>
        ))
      )}
    </div>
  );

  const renderProfile = () => (
    <div className="message-section">
      <div className="message-profile-card">
        <span className="message-system-avatar">我</span>
        <div>
          <strong>我的名片</strong>
          <small>Me</small>
        </div>
      </div>
    </div>
  );

  const activeCharacter = chatId ? characterMap[chatId] || { id: chatId, name: "聊天" } : null;
  if (activeCharacter) {
    const history = messageState.histories[chatId] || [];
    const meProfile = getPrimaryMeProfile();
    const activeTransferMessage = history.find((message) => message.id === activeTransferMessageId && message.kind === "transfer");
    return (
      <section className="full-page message-page chat-page">
        <header className="message-topbar">
          <button onClick={closeChat} aria-label="返回">
            <ChevronLeft size={21} />
          </button>
          <strong>{activeCharacter.name}</strong>
          <span></span>
        </header>
        <div className="chat-list" ref={chatListRef}>
          {history.map((message) => (
            <div className={`chat-bubble-row ${message.from === "me" ? "mine" : ""} ${message.kind === "recall" ? "recall-row" : ""}`} key={message.id}>
              {message.from !== "me" && message.kind !== "recall" && <MessageAvatar character={activeCharacter} />}
              <span
                className="chat-message-stack"
                onPointerDown={() => startRecallPress(message)}
                onPointerUp={cancelRecallPress}
                onPointerCancel={cancelRecallPress}
                onPointerLeave={cancelRecallPress}
                onDoubleClick={() => recallRoleMessage(message)}
              >
                {message.kind === "recall" ? (
                  <span className="chat-recall-pill">{message.text || `${activeCharacter.name || "角色"}撤回了一条消息`}</span>
                ) : message.kind === "transfer" ? (
                  <TransferCard
                    message={message}
                    characterName={activeCharacter.name || "角色"}
                    onOpen={() => {
                      cancelRecallPress();
                      setActiveTransferMessageId(message.id);
                    }}
                  />
                ) : (
                  <span
                    className="chat-bubble"
                  >
                    {message.text}
                  </span>
                )}
                {message.kind !== "recall" && <time className="chat-message-time">{formatChatClock(message.createdAt)}</time>}
              </span>
              {message.from === "me" && message.kind !== "recall" && <MessageAvatar character={meProfile} />}
            </div>
          ))}
          {sending && (
            <div className="chat-bubble-row">
              <MessageAvatar character={activeCharacter} />
              <span className="chat-bubble typing-bubble">正在输入...</span>
            </div>
          )}
        </div>
        <div className={`chat-input-area ${actionPanelOpen ? "expanded" : ""}`}>
          <div className="chat-composer">
            <button
              className="chat-plus-button"
              onClick={() => setActionPanelOpen((current) => !current)}
              disabled={sending}
              aria-label="更多功能"
            >
              +
            </button>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
              if (event.key === "Enter") sendMessage();
            }} placeholder="输入消息" disabled={sending} />
            <button onClick={sendMessage} disabled={sending}>{sending ? "等待" : "发送"}</button>
          </div>
          {actionPanelOpen && (
            <div className="chat-action-panel">
              <div className="chat-action-grid">
                {[
                  ["transfer", "转账"],
                  ["poke", "戳一戳"],
                  ["memory", "记忆"],
                  ["settings", "设置"],
                  ["proactive", "主动消息"],
                  ["photo", "图片"],
                  ["voice", "语音"],
                  ["note", "备注"],
                ].map(([type, label]) => (
                  <button
                    key={type}
                    onClick={() => {
                      if (type === "transfer") setTransferOpen(true);
                      if (type === "proactive") triggerProactiveMessage();
                    }}
                  >
                    <span><ChatActionIcon type={type} /></span>
                    <em>{label}</em>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {actionPanelOpen && (
          transferOpen && (
            <div className="transfer-popover-backdrop">
              <div className="transfer-popover">
                <div className="transfer-inline-head">
                  <button onClick={() => setTransferOpen(false)} aria-label="关闭转账">×</button>
                  <strong>转账给 {activeCharacter.name || "角色"}</strong>
                </div>
                <input
                  autoFocus
                  inputMode="decimal"
                  value={transferAmount}
                  onChange={(event) => setTransferAmount(event.target.value)}
                  placeholder="输入金额 (¥)"
                />
                <input
                  value={transferNote}
                  onChange={(event) => setTransferNote(event.target.value)}
                  placeholder="备注，可不填"
                />
                <div className="transfer-modal-actions">
                  <button onClick={() => setTransferOpen(false)}>取消</button>
                  <button onClick={sendTransfer}>发送转账</button>
                </div>
              </div>
            </div>
          )
        )}
        {activeTransferMessage && (
          <div className="wechat-transfer-backdrop" onClick={() => setActiveTransferMessageId("")}>
            <section className="wechat-transfer-sheet" onClick={(event) => event.stopPropagation()}>
              <button className="wechat-transfer-close" onClick={() => setActiveTransferMessageId("")} aria-label="关闭">×</button>
              <div className="wechat-transfer-brand">
                <span>
                  <svg viewBox="0 0 28 28" aria-hidden="true">
                    <path d="M14 3.8 24.2 9v10L14 24.2 3.8 19V9L14 3.8Z" />
                    <path d="M10 12.2h8M14 8.8v8.4" />
                  </svg>
                </span>
                <strong>{activeTransferMessage.transferDirection === "outgoing" ? `发给 ${activeCharacter.name || "角色"} 的红包` : `${activeCharacter.name || "角色"} 发来的红包`}</strong>
              </div>
              <div className="wechat-transfer-amount">¥{Number(activeTransferMessage.amount || 0).toFixed(2)}</div>
              <p>{activeTransferMessage.note || "微信红包"}</p>
              <div className="wechat-transfer-status">
                {activeTransferMessage.status === "accepted"
                  ? activeTransferMessage.transferDirection === "outgoing" ? "对方已收款" : "已接收"
                  : activeTransferMessage.status === "rejected"
                    ? activeTransferMessage.transferDirection === "outgoing" ? "对方已退还" : "已拒绝"
                    : activeTransferMessage.transferDirection === "outgoing" ? "等待对方确认" : "待接收"}
              </div>
              {activeTransferMessage.transferDirection !== "outgoing" && activeTransferMessage.status === "pending" && (
                <div className="wechat-transfer-actions">
                  <button onClick={() => settleIncomingTransfer(activeTransferMessage, false)}>退还</button>
                  <button onClick={() => settleIncomingTransfer(activeTransferMessage, true)}>收款</button>
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="full-page message-page wechat-page">
      <header className="message-topbar wechat-topbar">
        {messageTab === "contacts" ? (
          <span></span>
        ) : (
          <button className="wechat-back-hotspot" onClick={handleMessageBack} aria-label="返回">
            <ChevronLeft size={22} />
          </button>
        )}
        <strong>{messageTab === "messages" ? `信息${unreadCount ? ` (${unreadCount})` : ""}` : messageTab === "contacts" ? "联系人" : messageTab === "friends" ? "新的朋友" : messageTab === "groups" ? "群聊" : messageTab === "moments" ? "朋友圈" : "我"}</strong>
        <button className="message-add wechat-plus" onClick={() => openMessageTab("contacts")} aria-label="添加">
          <svg viewBox="0 0 28 28" aria-hidden="true">
            <circle cx="14" cy="14" r="11.2" />
            <path d="M14 8.4v11.2M8.4 14h11.2" />
          </svg>
        </button>
      </header>
      <main className="message-main">
        {messageTab === "messages" && renderMessages()}
        {messageTab === "contacts" && renderContacts()}
        {messageTab === "friends" && renderFriendRequests()}
        {messageTab === "groups" && renderGroups()}
        {messageTab === "moments" && renderMoments()}
        {messageTab === "me" && renderProfile()}
      </main>
      {messageTab !== "moments" && (
        <nav className="message-tabbar" aria-label="消息导航">
          {[
            ["messages", "信息"],
            ["contacts", "联系人"],
            ["moments", "朋友圈"],
            ["me", "我"],
          ].map(([id, cn]) => (
            <button className={messageTab === id ? "active" : ""} key={id} onClick={() => openMessageTab(id)}>
              <span className="wechat-tab-icon">
                <WechatTabIcon type={id} />
                {id === "messages" && unreadCount > 0 && <i>{unreadCount}</i>}
              </span>
              <span>{cn}</span>
            </button>
          ))}
        </nav>
      )}
    </section>
  );
}

function WorldbookAppScreen({ onClose }) {
  const [savedWorlds, setSavedWorlds] = useState(readStoredWorldbookWorlds);
  const [syncedCharacters, setSyncedCharacters] = useState(readWorldbookCharacterList);
  const worlds = useMemo(
    () => savedWorlds.map((world) => mergeWorldCharacters(world, syncedCharacters)),
    [savedWorlds, syncedCharacters],
  );
  const [selectedWorldId, setSelectedWorldId] = useState("");
  const [view, setView] = useState("library");
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [draftWorld, setDraftWorld] = useState(() => ({
    name: "",
    genre: "",
    tone: "",
    coverId: worldbookCoverMaterials[0].id,
  }));
  const selectedWorld = worlds.find((world) => world.id === selectedWorldId) || worlds[0] || null;
  const selectedCharacter = selectedWorld?.characters?.find((character) => character.id === selectedCharacterId) || selectedWorld?.characters?.[0];
  const selectedCover = worldbookCoverMaterials.find((cover) => cover.id === selectedWorld?.coverId) || worldbookCoverMaterials[0];
  const draftCover = worldbookCoverMaterials.find((cover) => cover.id === draftWorld.coverId) || worldbookCoverMaterials[0];

  useEffect(() => {
    window.localStorage.setItem(WORLDBOOK_STORAGE_KEY, JSON.stringify(savedWorlds));
  }, [savedWorlds]);

  useEffect(() => {
    const refreshCharacters = () => setSyncedCharacters(readWorldbookCharacterList());
    refreshCharacters();
    window.addEventListener("storage", refreshCharacters);
    window.addEventListener("focus", refreshCharacters);
    return () => {
      window.removeEventListener("storage", refreshCharacters);
      window.removeEventListener("focus", refreshCharacters);
    };
  }, []);

  const openWorld = (worldId) => {
    setSelectedWorldId(worldId);
    setSelectedCharacterId("");
    setView("overview");
  };

  const openCharacters = () => {
    setSelectedCharacterId("");
    setView("characters");
  };

  const openCharacter = (characterId) => {
    setSelectedCharacterId(characterId);
    setView("detail");
  };

  const openAddWorld = () => {
    const nextCover = worldbookCoverMaterials[savedWorlds.length % worldbookCoverMaterials.length];
    setDraftWorld({ name: "", genre: "", tone: "", coverId: nextCover.id });
    setView("add");
  };

  const rotateDraftCover = () => {
    const currentIndex = worldbookCoverMaterials.findIndex((cover) => cover.id === draftWorld.coverId);
    const next = worldbookCoverMaterials[(currentIndex + 1 + worldbookCoverMaterials.length) % worldbookCoverMaterials.length];
    setDraftWorld((current) => ({ ...current, coverId: next.id }));
  };

  const saveWorld = () => {
    const name = draftWorld.name.trim() || "未命名世界";
    const genre = draftWorld.genre.trim() || draftCover.tag;
    const tone = draftWorld.tone.trim() || draftCover.note;
    const now = new Date();
    const createdWorld = {
      id: `custom-${Date.now()}`,
      custom: true,
      coverId: draftWorld.coverId,
      name,
      genre,
      tone,
      updated: `${now.getMonth() + 1}月${now.getDate()}日`,
      tint: "custom",
      stats: { main: 0, support: 0, links: 0, memories: 0 },
      characters: [],
      memories: [],
    };
    setSavedWorlds((current) => [createdWorld, ...current]);
    setSelectedWorldId(createdWorld.id);
    setSelectedCharacterId("");
    setView("overview");
  };

  const deleteWorld = (event, worldId) => {
    event.stopPropagation();
    const world = savedWorlds.find((item) => item.id === worldId);
    if (!world) return;
    if (!window.confirm(`删除世界书「${world.name}」？角色不会被删除。`)) return;
    setSavedWorlds((current) => current.filter((item) => item.id !== worldId));
    if (selectedWorldId === worldId) {
      setSelectedWorldId("");
      setSelectedCharacterId("");
      setView("library");
    }
  };

  const handleBack = () => {
    if (view === "library") {
      onClose();
      return;
    }
    if (view === "add" || view === "materials") {
      setView("library");
      return;
    }
    if (view === "overview") {
      setView("library");
      return;
    }
    if (view === "characters" || view === "relations") {
      setView("overview");
      return;
    }
    setView("characters");
  };

  const renderCover = (cover, size = "normal", selected = false) => (
    <span className={`worldbook-cover-art ${size} ${selected ? "selected" : ""}`} aria-hidden="true">
      <img src={worldbookAsset(cover.image)} alt="" />
      {selected && <i>✓</i>}
    </span>
  );

  const worldStats = (world) => {
    if (!world) return { main: 0, support: 0, links: 0, memories: 0 };
    const main = world.stats?.main ?? world.characters?.length ?? 0;
    const support = world.stats?.support ?? 0;
    const links = world.stats?.links ?? Math.max(0, (world.characters?.length || 0) - 1);
    const memories = world.stats?.memories ?? world.memories?.length ?? 0;
    return { main, support, links, memories };
  };

  const renderLibrary = () => (
    <main className="worldbook-main worldbook-library">
      <button className="worldbook-library-back" onClick={onClose} aria-label="返回">
        <ChevronLeft size={24} />
      </button>
      <section className="worldbook-library-hero">
        <img src={worldbookAsset("hero-worldbook.png")} alt="" />
        <div className="worldbook-library-head">
          <h1>世界书</h1>
          <p>你的角色世界与生平档案</p>
        </div>
        <button className="worldbook-primary worldbook-hero-add" onClick={openAddWorld}>
          <Plus size={21} strokeWidth={1.9} />
          <span>添加世界</span>
        </button>
      </section>
      <section className="worldbook-search-row">
        <button className="worldbook-search">
          <Search size={17} />
          <span>搜索世界 / 人物</span>
        </button>
        <button className="worldbook-filter" aria-label="筛选">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16l-6.4 7.2v4.4l-3.2 1.8v-6.2z" /></svg>
        </button>
      </section>
      <section className="worldbook-world-list" aria-label="世界列表">
        {worlds.map((world) => {
          const cover = worldbookCoverMaterials.find((item) => item.id === world.coverId) || worldbookCoverMaterials[0];
          const stats = worldStats(world);
          return (
            <article className="worldbook-world-card" key={world.id}>
              <button className="worldbook-world-open" onClick={() => openWorld(world.id)}>
                {renderCover(cover, "card")}
                <span className="worldbook-world-copy">
                  <strong>{world.name}</strong>
                  <em>{world.genre}</em>
                  <small>人物数量　{stats.main + stats.support} 人</small>
                  <small>最近更新　{world.updated}</small>
                </span>
                <ChevronRight size={21} strokeWidth={1.7} />
              </button>
              <button className="worldbook-delete-world" onClick={(event) => deleteWorld(event, world.id)}>删除</button>
            </article>
          );
        })}
        {worlds.length === 0 && (
          <article className="worldbook-empty worldbook-library-empty">
            <Sparkles size={22} />
            <strong>还没有世界书</strong>
            <p>点击添加世界，系统会自动分配一张横版封面。</p>
          </article>
        )}
        <button className="worldbook-create-card" onClick={openAddWorld}>
          <span><Plus size={22} /></span>
          <strong>创建新世界 · 自动分配封面</strong>
          <em>快速开始你的角色世界</em>
        </button>
      </section>
    </main>
  );

  const renderHeader = (title, action = null) => (
    <header className="worldbook-header">
      <button onClick={handleBack} aria-label="返回">
        <ChevronLeft size={23} />
      </button>
      <span>{title}</span>
      {action || <i></i>}
    </header>
  );

  const stats = worldStats(selectedWorld);
  const overviewEntries = [
    { id: "main", title: "主要人物", desc: "世界中的核心人物一览", count: stats.main, icon: UserRound, action: openCharacters },
    { id: "support", title: "支线人物", desc: "配角与重要关联人物", count: stats.support, icon: UsersRound, action: openCharacters },
    { id: "relations", title: "关系网", desc: "人物关系与情感脉络", count: stats.links, icon: Heart, action: () => setView("relations") },
    { id: "timeline", title: "生平时间线", desc: "关键事件与人生轨迹", count: "", icon: ClipboardCheck, action: () => setView("relations") },
    { id: "memories", title: "共同记忆", desc: "重要记忆片段集合", count: stats.memories, icon: BookMarked, action: () => setView("relations") },
  ];

  const renderOverview = () => (
    <>
      <main className="worldbook-main worldbook-overview-main">
        <section className="worldbook-overview-hero">
          <img src={worldbookAsset(selectedCover.image)} alt="" />
          <button className="worldbook-floating-back" onClick={handleBack} aria-label="返回">
            <ChevronLeft size={22} />
          </button>
          <div className="worldbook-overview-copy">
            <h1>{selectedWorld.name}</h1>
            <em>{selectedWorld.genre}</em>
            <p>{selectedWorld.tone || selectedCover.note}</p>
          </div>
        </section>
        <section className="worldbook-stat-grid">
          <span><em>主要人物</em><strong>{stats.main}</strong></span>
          <span><em>支线人物</em><strong>{stats.support}</strong></span>
          <span><em>关系</em><strong>{stats.links}</strong></span>
          <span><em>记忆</em><strong>{stats.memories}</strong></span>
        </section>
        <button className="worldbook-primary worldbook-person-add">
          <Plus size={20} />
          <span>新增人物</span>
        </button>
        <section className="worldbook-section-list">
          {overviewEntries.map((entry) => {
            const Icon = entry.icon;
            return (
              <button key={entry.id} onClick={entry.action}>
                <span className={`worldbook-section-icon ${entry.id}`}><Icon size={20} strokeWidth={1.8} /></span>
                <span>
                  <strong>{entry.title}</strong>
                  <em>{entry.desc}</em>
                </span>
                <small>{entry.count}</small>
                <ChevronRight size={18} strokeWidth={1.7} />
              </button>
            );
          })}
        </section>
      </main>
    </>
  );

  const renderCharacters = () => (
    <>
      {renderHeader("人物档案")}
      <main className="worldbook-main">
        <section className="worldbook-list-head">
          <span>{selectedWorld.name}</span>
          <h1>人物档案</h1>
          <p>点标题进入人物背景与生平正文。</p>
        </section>
        <section className="worldbook-person-list">
          {(selectedWorld.characters || []).map((character) => (
            <button key={character.id} onClick={() => openCharacter(character.id)}>
              <span className="worldbook-avatar">{character.avatar ? <img src={character.avatar} alt="" /> : character.name.slice(0, 1)}</span>
              <span>
                <strong>{character.name}</strong>
                <em>{character.identity} / {character.relation}</em>
              </span>
              <small>{character.status}</small>
              <ChevronRight size={17} />
            </button>
          ))}
          {(!selectedWorld.characters || selectedWorld.characters.length === 0) && (
            <article className="worldbook-empty">
              <Sparkles size={22} />
              <strong>这个世界还没有人物</strong>
              <p>先把世界建好，之后可继续添加人物背景、生平、关系和记忆。</p>
            </article>
          )}
        </section>
      </main>
    </>
  );

  const renderDetail = () => selectedCharacter ? (
    <>
      <main className="worldbook-main worldbook-detail-main">
        <section className="worldbook-detail-hero">
          <img src={worldbookAsset(selectedCover.image)} alt="" className="worldbook-detail-cover" />
          <button className="worldbook-floating-back" onClick={handleBack} aria-label="返回">
            <ChevronLeft size={22} />
          </button>
          <span className="worldbook-detail-actions">
            <button aria-label="收藏">☆</button>
            <button aria-label="分享">⌯</button>
          </span>
          <span className="worldbook-detail-avatar">
            {selectedCharacter.avatar ? <img src={selectedCharacter.avatar} alt="" /> : selectedCharacter.name.slice(0, 1)}
          </span>
          <div className="worldbook-detail-name">
            <h1>{selectedCharacter.name}</h1>
            <p>{selectedCharacter.identity} / {selectedCharacter.relation}</p>
            <span>{selectedCharacter.status}</span>
          </div>
        </section>
        <nav className="worldbook-detail-tabs">
          {["档案", "时间线", "记忆", "关系"].map((tab, index) => (
            <button className={index === 0 ? "active" : ""} key={tab}>{tab}</button>
          ))}
        </nav>
        <section className="worldbook-bio-list">
          {(selectedCharacter.sections || []).map(([title, body]) => (
            <article key={title}>
              <h2>{title}</h2>
              <p>{body}</p>
            </article>
          ))}
          <article className="worldbook-timeline">
            <h2>重要经历</h2>
            {["初遇雨巷", "旧画未完", "王城夜谈"].map((item, index) => (
              <p key={item}><i></i><strong>{item}</strong><span>{index === 0 ? "相识" : index === 1 ? "信任" : "同行"}</span></p>
            ))}
          </article>
        </section>
      </main>
    </>
  ) : renderCharacters();

  const renderRelations = () => (
    <>
      {renderHeader("记忆库")}
      <main className="worldbook-main">
        <section className="worldbook-list-head">
          <span>{selectedWorld.name}</span>
          <h1>共同记忆</h1>
          <p>关系网用于理解人物之间的情感与经历。</p>
        </section>
        <section className="worldbook-memory-list">
          {(selectedWorld.memories || []).map((memory, index) => (
            <button key={memory}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{memory}</strong>
              <ChevronRight size={16} />
            </button>
          ))}
        </section>
      </main>
    </>
  );

  const renderAddWorld = () => (
    <>
      {renderHeader("添加世界")}
      <main className="worldbook-main worldbook-add-main">
        <section className="worldbook-add-panel">
          <div className="worldbook-add-cover">
            <span>自动匹配封面</span>
            <img src={worldbookAsset(draftCover.image)} alt="" />
            <button onClick={rotateDraftCover}>
              <Clock3 size={16} />
              <span>换一张</span>
            </button>
          </div>
          <div className="worldbook-field-stack">
            <label>
              <span>世界名称 *</span>
              <input value={draftWorld.name} maxLength={20} onChange={(event) => setDraftWorld((current) => ({ ...current, name: event.target.value }))} placeholder="请输入世界名称" />
              <small>{draftWorld.name.length}/20</small>
            </label>
            <label>
              <span>类型标签 *</span>
              <button className="worldbook-select-field" onClick={() => setView("materials")}>
                <em>{draftWorld.genre || "选择或输入标签（最多 3 个）"}</em>
                <ChevronRight size={18} />
              </button>
            </label>
            <label>
              <span>世界简介</span>
              <textarea value={draftWorld.tone} maxLength={200} onChange={(event) => setDraftWorld((current) => ({ ...current, tone: event.target.value }))} placeholder="介绍这个世界的背景、设定与核心冲突..."></textarea>
              <small>{draftWorld.tone.length}/200</small>
            </label>
          </div>
          <label className="worldbook-toggle-row">
            <span>保存后进入人物档案</span>
            <input type="checkbox" defaultChecked />
          </label>
          <button className="worldbook-primary worldbook-save-button" onClick={saveWorld}>保存世界</button>
          <button className="worldbook-secondary" onClick={rotateDraftCover}>
            <Clock3 size={17} />
            <span>换一张素材</span>
          </button>
        </section>
      </main>
    </>
  );

  const renderMaterials = () => (
    <>
      {renderHeader("选择封面素材")}
      <main className="worldbook-main worldbook-material-main">
        <section className="worldbook-material-head">
          <p>系统内置 12 张，可随时更换</p>
        </section>
        <section className="worldbook-material-grid">
          {worldbookCoverMaterials.map((cover) => {
            const isSelected = cover.id === draftWorld.coverId;
            return (
              <button className={isSelected ? "active" : ""} key={cover.id} onClick={() => setDraftWorld((current) => ({ ...current, coverId: cover.id, genre: cover.tag }))}>
                {renderCover(cover, "material", isSelected)}
                <strong>{cover.name}</strong>
              </button>
            );
          })}
        </section>
        <button className="worldbook-primary worldbook-use-cover" onClick={() => setView("add")}>使用此封面</button>
      </main>
    </>
  );

  const renderTabbar = () => (
    <nav className="worldbook-tabbar" aria-label="世界书导航">
      {[
        ["library", "世界库", BookMarked],
        ["characters", "人物档案", UserRound],
        ["relations", "记忆库", BookMarked],
        ["materials", "素材馆", Palette],
      ].map(([id, label, Icon]) => (
        <button key={id} className={(view === id || (id === "characters" && view === "detail")) ? "active" : ""} onClick={() => {
          if ((id === "characters" || id === "relations") && !selectedWorld) return;
          if (id === "characters" && !selectedWorldId) openWorld(selectedWorld.id);
          else setView(id);
        }}>
          <Icon size={19} strokeWidth={1.8} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );

  return (
    <section className="full-page app-page worldbook-page">
      {view === "library" && renderLibrary()}
      {view === "add" && renderAddWorld()}
      {view === "materials" && renderMaterials()}
      {view === "overview" && renderOverview()}
      {view === "characters" && renderCharacters()}
      {view === "detail" && renderDetail()}
      {view === "relations" && renderRelations()}
      {view !== "add" && view !== "materials" && view !== "detail" && renderTabbar()}
    </section>
  );
}

function OpenedApp({ app, onClose, onMessageUnreadChange }) {
  const isWallet = app.title === "钱包";
  const isWork = app.title === "工作";
  const isMessages = app.title === "消息";
  const isWorldbook = app.title === "世界书";
  const [walletData, setWalletData] = useState(() => {
    try {
      const stored = window.localStorage.getItem(WALLET_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          balance: Number(parsed.balance) || 0,
          transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        };
      }
    } catch {
      return { balance: 0, transactions: [] };
    }
    return { balance: 0, transactions: [] };
  });
  const [walletAmount, setWalletAmount] = useState("");
  const [walletDesc, setWalletDesc] = useState("");
  const [walletMode, setWalletMode] = useState(null);
  const formatMoney = (amount) =>
    Number(amount || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  useEffect(() => {
    if (!isWallet) return;
    window.localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(walletData));
  }, [isWallet, walletData]);

  const currentMonth = new Date().getMonth() + 1;
  const monthTransactions = walletData.transactions.filter((bill) => Number(String(bill.date || "").split("-")[0]) === currentMonth);
  const walletIncome = monthTransactions.filter((bill) => bill.type === "add").reduce((sum, bill) => sum + bill.amount, 0);
  const walletExpense = monthTransactions.filter((bill) => bill.type === "sub").reduce((sum, bill) => sum + bill.amount, 0);

  const openWalletModal = (type) => {
    setWalletMode(type);
    setWalletAmount("");
    setWalletDesc("");
  };

  const changeWallet = () => {
    if (!walletMode) return;
    const amount = Number(walletAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const now = new Date();
    const date = `${now.getMonth() + 1}-${now.getDate()} ${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes(),
    ).padStart(2, "0")}`;
    setWalletData((current) => ({
      balance: current.balance + (walletMode === "add" ? amount : -amount),
      transactions: [
        {
          id: Date.now(),
          type: walletMode,
          amount,
          desc: walletDesc.trim(),
          date,
        },
        ...current.transactions,
      ],
    }));
    setWalletAmount("");
    setWalletDesc("");
    setWalletMode(null);
  };

  const clearWalletHistory = () => {
    setWalletData((current) => ({ ...current, transactions: [] }));
  };

  if (isWork) return <WorkAppScreen onClose={onClose} />;
  if (isMessages) return <MessageAppScreen onClose={onClose} onUnreadChange={onMessageUnreadChange} />;
  if (isWorldbook) return <WorldbookAppScreen onClose={onClose} />;

  return (
    <section
      className={`full-page app-page ${isWallet ? "wallet-page" : ""}`}
    >
      <header className="page-header">
        <button className={isWallet ? "api-back-button" : ""} onClick={onClose} aria-label="返回">
          <ChevronLeft size={20} />
          {isWallet && <span>返回</span>}
        </button>
        <span>{app.title}</span>
        <span></span>
      </header>
      {isWallet ? (
        <div className="wallet-content">
          <section className="bank-card">
            <div className="card-type">BLACK PLATINUM</div>
            <div className="card-chip"></div>
            <div className="card-balance-label">Total Balance</div>
            <div className="card-balance">
              <span className="currency">¥</span>
              <span>{formatMoney(walletData.balance)}</span>
            </div>
            <div className="card-footer">
              <span>**** **** **** 8888</span>
              <span>VALID 12/28</span>
            </div>
            <div className="card-actions">
              <button className="mini-action-btn" onClick={() => openWalletModal("add")} aria-label="入账">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                </svg>
              </button>
              <button className="mini-action-btn" onClick={() => openWalletModal("sub")} aria-label="支出">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19 13H5v-2h14v2z" />
                </svg>
              </button>
            </div>
          </section>

          <section className="wallet-analytics">
            <div className="ana-box">
              <div className="ana-label">本月收入</div>
              <div className="ana-val">¥{formatMoney(walletIncome)}</div>
            </div>
            <div className="ana-divider"></div>
            <div className="ana-box">
              <div className="ana-label">本月支出</div>
              <div className="ana-val">¥{formatMoney(walletExpense)}</div>
            </div>
          </section>

          <section className="wallet-apps" aria-label="钱包服务">
            {[
              {
                label: "扫一扫",
                path: "M4 4h6v6H4zm16 0h-6v6h6zM4 14h6v6H4zm14 0h2v2h-2zm-2 2h2v2h-2zm2 2h2v2h-2zM14 14h2v2h-2zm0 4h2v2h-2zM6 6h2v2H6zm10 0h2v2h-2zM6 16h2v2H6z",
              },
              { label: "付款码", path: "M3 4h4v16H3zm6 0h2v16H9zm4 0h4v16h-4zm6 0h2v16h-2z" },
              { label: "理财", path: "M16 6l2.3 2.3-4.9 4.9-4-4L2 16.6 3.4 18l6-6 4 4 6.3-6.3L22 12V6z" },
              {
                label: "卡包",
                path: "M21 18v1c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z",
              },
            ].map((item) => (
              <button className="w-app" key={item.label}>
                <span className="w-app-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d={item.path} />
                  </svg>
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </section>

          <section className="tx-section">
            <div className="tx-section-title">
              <span>近期账单</span>
              <button onClick={clearWalletHistory}>清空</button>
            </div>
            <div className="tx-list">
              {walletData.transactions.length === 0 ? (
                <div className="empty-tx">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                  </svg>
                  <p>本月暂无账单流水</p>
                </div>
              ) : (
                walletData.transactions.map((bill, index) => {
                  const isAdd = bill.type === "add";
                  return (
                    <div className="tx-item" key={bill.id} style={{ animationDelay: `${index * 0.06}s` }}>
                      <div className="tx-left">
                        <div className={`tx-icon ${isAdd ? "add" : "sub"}`}>
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            {isAdd ? (
                              <>
                                <path d="M12 4v10" />
                                <path d="m7.8 10.2 4.2 4.2 4.2-4.2" />
                                <path d="M5.5 18.8h13" />
                              </>
                            ) : (
                              <>
                                <path d="M12 20V10" />
                                <path d="m7.8 13.8 4.2-4.2 4.2 4.2" />
                                <path d="M5.5 5.2h13" />
                              </>
                            )}
                          </svg>
                        </div>
                        <div className="tx-info">
                          <span className="tx-title">{bill.desc || (isAdd ? "入账" : "支出")}</span>
                          <span className="tx-date">{bill.date}</span>
                        </div>
                      </div>
                      <div className={`tx-amount ${isAdd ? "add" : "sub"}`}>
                        {isAdd ? "+" : "-"}{formatMoney(bill.amount)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
          {walletMode && (
            <div className="wallet-modal-backdrop">
              <div className="wallet-modal">
                <strong>{walletMode === "add" ? "入账金额" : "支出金额"}</strong>
                <input
                  autoFocus
                  inputMode="decimal"
                  value={walletAmount}
                  onChange={(event) => setWalletAmount(event.target.value)}
                  placeholder="输入金额 (¥)"
                />
                <input
                  value={walletDesc}
                  onChange={(event) => setWalletDesc(event.target.value)}
                  placeholder="输入备注 (如：工资、购物)"
                />
                <div className="wallet-modal-actions">
                  <button onClick={() => setWalletMode(null)}>取消</button>
                  <button onClick={changeWallet}>确定</button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="quiet-center">
          <div className="soft-line"></div>
        </div>
      )}
    </section>
  );
}

function LaunchLoader() {
  return (
    <section className="launch-loader" aria-label="正在进入">
      <div className="launch-loader-track">
        <span></span>
      </div>
    </section>
  );
}

export function App() {
  const [locked, setLocked] = useState(true);
  const [tab, setTab] = useState("home");
  const [openedApp, setOpenedApp] = useState(null);
  const [settingPage, setSettingPage] = useState(null);
  const [launching, setLaunching] = useState(null);
  const [hasShownLaunch, setHasShownLaunch] = useState(false);
  const [hideCharacterTabs, setHideCharacterTabs] = useState(false);
  const [hideMeTabs, setHideMeTabs] = useState(false);
  const [messageUnread, setMessageUnread] = useState(() => getMessageUnreadCount());
  const [messageToast, setMessageToast] = useState(null);

  useEffect(() => {
    const preventZoom = (event) => event.preventDefault();
    document.addEventListener("gesturestart", preventZoom, { passive: false });
    document.addEventListener("gesturechange", preventZoom, { passive: false });
    document.addEventListener("gestureend", preventZoom, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", preventZoom);
      document.removeEventListener("gesturechange", preventZoom);
      document.removeEventListener("gestureend", preventZoom);
    };
  }, []);

  useEffect(() => {
    setChromeColor(getChromeColor({ locked, tab, openedApp, settingPage, launching }));
  }, [locked, tab, openedApp?.title, settingPage?.id, launching?.type, launching?.payload?.title]);

  useEffect(() => {
    if (!launching) return undefined;
    const timer = window.setTimeout(() => {
      if (launching.type === "app") setOpenedApp(launching.payload);
      if (launching.type === "setting") setSettingPage(launching.payload);
      setLaunching(null);
    }, 920);
    return () => window.clearTimeout(timer);
  }, [launching]);

  useEffect(() => {
    const refreshUnread = () => setMessageUnread(getMessageUnreadCount());
    refreshUnread();
    window.addEventListener("storage", refreshUnread);
    return () => window.removeEventListener("storage", refreshUnread);
  }, []);

  useEffect(() => {
    if (locked || openedApp?.title === "消息" || launching) return undefined;

    const maybeSendProactive = async () => {
      if (openedApp?.title === "消息") return;
      const now = Date.now();
      const lastAt = Number(window.localStorage.getItem(PROACTIVE_MESSAGE_STORAGE_KEY)) || 0;
      if (now - lastAt < PROACTIVE_MESSAGE_COOLDOWN_MS) return;
      if (Math.random() > 0.28) return;

      const state = getStoredMessageState();
      const contacts = state.contacts.filter((contact) => contact.characterId);
      if (!contacts.length) return;
      const characterList = readMessageCharacters();
      const characters = Object.fromEntries(characterList.map((character) => [character.id, character]));
      const meProfiles = readMessageMeProfiles();
      const relations = readMessageRelations();
      const worldbooks = readWorldbookWorldsForSelect();
      const contact = contacts[now % contacts.length];
      const character = characters[contact.characterId] || { id: contact.characterId, name: "角色" };
      const history = state.histories?.[contact.characterId] || [];
      const messages = await callRoleProactiveApi({
        character,
        history,
        relationshipContext: buildRelationshipContext({
          character,
          characters: characterList,
          meProfiles,
          relations,
        }),
        worldbookContext: buildWorldbookContext({
          character,
          worlds: worldbooks,
          characters: characterList,
        }),
      });
      if (!messages.length) return;
      let next = state;
      messages.forEach((text) => {
        next = appendChatMessage(next, contact.characterId, {
          from: "role",
          text,
        });
      });
      writeStoredMessageState(next);
      window.localStorage.setItem(PROACTIVE_MESSAGE_STORAGE_KEY, String(now));
      setMessageUnread(getMessageUnreadCount(next));
      setMessageToast({
        character,
        text: messages[0],
      });
    };

    const firstTimer = window.setTimeout(maybeSendProactive, 90000);
    const interval = window.setInterval(maybeSendProactive, PROACTIVE_MESSAGE_CHECK_MS);
    return () => {
      window.clearTimeout(firstTimer);
      window.clearInterval(interval);
    };
  }, [locked, openedApp?.title, launching]);

  useEffect(() => {
    if (!messageToast) return undefined;
    const timer = window.setTimeout(() => setMessageToast(null), 5200);
    return () => window.clearTimeout(timer);
  }, [messageToast]);

  const openWithLoader = (type, payload) => {
    setChromeColor(getChromeColor({
      locked: false,
      tab,
      openedApp: type === "app" ? payload : null,
      settingPage: type === "setting" ? payload : null,
      launching: { type, payload },
    }));
    if (hasShownLaunch) {
      if (type === "app") setOpenedApp(payload);
      if (type === "setting") setSettingPage(payload);
      return;
    }
    setHasShownLaunch(true);
    setLaunching({ type, payload });
  };

  const openMessagesFromToast = () => {
    setMessageToast(null);
    openWithLoader("app", { title: "消息", originX: window.innerWidth / 2, originY: 88 });
  };

  const content = useMemo(() => {
    if (tab === "home") return <HomeScreen onOpen={(app) => openWithLoader("app", app)} messageUnread={messageUnread} />;
    if (tab === "characters") return <CharacterAppScreen onChildPageChange={setHideCharacterTabs} />;
    if (tab === "me") return <MeAppScreen onChildPageChange={setHideMeTabs} />;
    return <SettingsScreen onOpen={(item) => openWithLoader("setting", item)} />;
  }, [tab, hasShownLaunch, messageUnread]);

  useEffect(() => {
    if (tab !== "characters") setHideCharacterTabs(false);
    if (tab !== "me") setHideMeTabs(false);
  }, [tab]);

  if (locked) return <LockScreen onUnlock={() => setLocked(false)} />;

  const hasOverlay = Boolean(openedApp || settingPage || launching);
  const isMessageOpening = openedApp?.title === "消息" || (launching?.type === "app" && launching.payload?.title === "消息");
  const isWorldbookOpening = openedApp?.title === "世界书" || (launching?.type === "app" && launching.payload?.title === "世界书");
  const surfaceClass = [
    "phone-surface",
    `tab-${tab}`,
    hasOverlay ? "overlay-active" : "",
    isMessageOpening ? "message-opening" : "",
    isWorldbookOpening ? "worldbook-opening" : "",
    hideCharacterTabs ? "character-subpage-active" : "",
    hideMeTabs ? "me-subpage-active" : "",
  ].filter(Boolean).join(" ");

  return (
    <main className={surfaceClass}>
      <div className="phone-stage">
        {content}
        {!((tab === "characters" && hideCharacterTabs) || (tab === "me" && hideMeTabs)) && <BottomTabs active={tab} onChange={setTab} />}
      </div>
      {messageToast && !openedApp && !settingPage && !launching && (
        <button className="message-home-toast" onClick={openMessagesFromToast}>
          <MessageAvatar character={messageToast.character} />
          <span>
            <strong>{messageToast.character.name || "新消息"}</strong>
            <em>{messageToast.text}</em>
          </span>
          <i>+{Math.min(99, messageUnread)}</i>
        </button>
      )}
      {openedApp && <OpenedApp app={openedApp} onClose={() => {
        resetViewportScroll();
        setChromeColor(getChromeColor({ locked: false, tab, openedApp: null, settingPage, launching: null }));
        setOpenedApp(null);
        requestAnimationFrame(resetViewportScroll);
        window.setTimeout(resetViewportScroll, 80);
      }} onMessageUnreadChange={setMessageUnread} />}
      {settingPage?.id === "api" && <ApiSettingsPage onBack={() => {
        setChromeColor(getChromeColor({ locked: false, tab, openedApp, settingPage: null, launching: null }));
        setSettingPage(null);
      }} />}
      {settingPage && settingPage.id !== "api" && <GenericSettingPage item={settingPage} onBack={() => {
        setChromeColor(getChromeColor({ locked: false, tab, openedApp, settingPage: null, launching: null }));
        setSettingPage(null);
      }} />}
      {launching && <LaunchLoader />}
    </main>
  );
}
