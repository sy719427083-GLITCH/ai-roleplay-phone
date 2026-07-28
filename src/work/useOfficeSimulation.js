import { useEffect, useMemo, useRef, useState } from "react";
import { parseConfigs, STORAGE_KEY } from "../apiConfig.js";
import { createLocalConversation, formatOfficeAiError, generateAiOfficePlan, generateOfficeConversation } from "./officeConversation.js";
import { OFFICE_ACTIVITY_POINTS, getOfficePoint } from "./officeGeometry.js";
import { createOfficeRoute } from "./officeNavigation.js";
import { allocateOfficeActivities, getDistinctConversationIds } from "./officeScenePlan.js";
import { createLocalOfficePlan, createOfficeDailySeed, getOfficeIntervalKey } from "./officeSimulation.js";

export const ME_MANUAL_IDLE_MS = 10_000;

export function deriveCurrentSimulation({ persisted = {}, intervalKey, occupants = [], createPlan }) {
  const ids = new Set(occupants.map((item) => item.profile.id));
  const savedIds = Object.keys(persisted.plan?.characters || {});
  if (persisted.intervalKey === intervalKey && persisted.plan && savedIds.length === ids.size && savedIds.every((id) => ids.has(id))) return persisted.plan;
  return createPlan();
}

export function interruptMePlan(plan, profileId, { destination, now = Date.now(), label = "前往指定位置" }) {
  const participants = (plan?.conversation?.participantIds || []).filter((id) => id !== profileId);
  return {
    ...plan,
    id: `${plan?.id || "scene"}:manual:${now}`,
    characters: { ...(plan?.characters || {}), [profileId]: { activity: "walking", label, destination, startsAt: now, endsAt: now + ME_MANUAL_IDLE_MS, priority: "manual" } },
    conversation: participants.length >= 2 ? { ...plan.conversation, participantIds: participants } : null,
  };
}

export function resumeMeAutonomy({ plan, meId, autonomousActivity, now = Date.now() }) {
  return { ...plan, id: `${plan?.id || "scene"}:resume:${now}`, characters: { ...(plan?.characters || {}), [meId]: autonomousActivity } };
}

export function getRuntimeConversationParticipants(occupants = [], participantIds = []) {
  const assignedIds = new Set(occupants.map((item) => item.profile.id));
  const distinctIds = getDistinctConversationIds(participantIds, assignedIds);
  if (distinctIds.length < 2) return [];
  return distinctIds.map((id) => occupants.find((item) => item.profile.id === id)).filter(Boolean);
}

export function useOfficeSimulation({ occupants, simulation, dispatch, companyName = "office", projectContext = "", sceneRef, now, showNotice }) {
  const [plan, setPlan] = useState(null);
  const [characterStates, setCharacterStates] = useState({});
  const [conversation, setConversation] = useState(null);
  const [turnIndex, setTurnIndex] = useState(0);
  const timers = useRef(new Map());
  const planRun = useRef(0);
  const manualTimer = useRef(null);
  const manualRun = useRef(0);
  const me = occupants.find((item) => item.profile.source === "me");
  const key = `${getOfficeIntervalKey(new Date(now))}:${simulation.mode}:${occupants.map((item) => `${item.slotId}:${item.profile.id}`).join("|")}`;

  const clearTimers = () => {
    for (const timer of timers.current.values()) window.clearTimeout(timer);
    timers.current.clear();
  };

  useEffect(() => () => {
    planRun.current += 1;
    manualRun.current += 1;
    clearTimers();
    window.clearTimeout(manualTimer.current);
  }, []);

  useEffect(() => {
    const intervalKey = getOfficeIntervalKey(new Date(now));
    const seed = simulation.seed || createOfficeDailySeed(new Date(now), companyName);
    const createPlan = () => allocateOfficeActivities(createLocalOfficePlan({ occupants, now: new Date(now), seed, projectContext, previousPlan: simulation.plan }), occupants);
    let localPlan = deriveCurrentSimulation({ persisted: simulation, intervalKey, occupants, createPlan });
    if (simulation.manualMe && me && Number(simulation.manualMe.endsAt) > now) localPlan = { ...localPlan, id: `${localPlan.id}:manual-restored`, characters: { ...localPlan.characters, [me.profile.id]: simulation.manualMe } };
    setPlan(localPlan);
    dispatch({ type: "SET_SCENE_PLAN", value: { dateKey: seed.split(":").at(-1), seed, intervalKey, plan: localPlan, nextTransitionAt: localPlan.endsAt } });
    if (simulation.mode !== "ai" || occupants.length === 0) return undefined;
    let cancelled = false;
    const apiState = parseConfigs(window.localStorage.getItem(STORAGE_KEY));
    generateAiOfficePlan({ apiState, context: { occupants, now, endsAt: localPlan.endsAt, projectContext, destinations: [...Object.keys(OFFICE_ACTIVITY_POINTS), ...occupants.map((item) => `${item.slotId}-home`), "print-station"] } })
      .then((aiPlan) => {
        if (cancelled) return;
        const safePlan = allocateOfficeActivities(aiPlan, occupants);
        setPlan(safePlan);
        dispatch({ type: "SET_SCENE_PLAN", value: { dateKey: seed.split(":").at(-1), seed, intervalKey, plan: safePlan, nextTransitionAt: safePlan.endsAt } });
      })
      .catch((error) => {
        if (cancelled) return;
        const reason = formatOfficeAiError(error);
        showNotice(`AI 导演暂不可用：${reason}。已使用本地调度`, 4200);
      });
    return () => { cancelled = true; };
  }, [key]);

  useEffect(() => {
    window.clearTimeout(manualTimer.current);
    const run = manualRun.current + 1;
    manualRun.current = run;
    if (!simulation.manualMe || !me) return undefined;
    const resume = () => {
      if (manualRun.current !== run) return;
      const resumedAt = Date.now();
      const seed = simulation.seed || createOfficeDailySeed(new Date(resumedAt), companyName);
      const freshPlan = allocateOfficeActivities(createLocalOfficePlan({ occupants, now: new Date(resumedAt), seed, projectContext, previousPlan: plan }), occupants);
      const autonomousActivity = freshPlan.characters[me.profile.id];
      dispatch({ type: "END_MANUAL_ME" });
      if (autonomousActivity) setPlan((current) => resumeMeAutonomy({ plan: current || freshPlan, meId: me.profile.id, autonomousActivity, now: resumedAt }));
    };
    const remaining = Number(simulation.manualMe.endsAt) - Date.now();
    if (remaining <= 0) resume();
    else manualTimer.current = window.setTimeout(resume, remaining);
    return () => window.clearTimeout(manualTimer.current);
  }, [simulation.manualMe?.endsAt, me?.profile.id]);

  useEffect(() => {
    if (!plan) return;
    planRun.current += 1;
    const run = planRun.current;
    clearTimers();
    const bounds = sceneRef.current?.getBoundingClientRect();
    const viewport = bounds ? { width: bounds.width, height: bounds.height } : null;
    occupants.forEach((occupant) => {
      const profileId = occupant.profile.id;
      const activity = plan.characters?.[profileId];
      if (!activity) return;
      setCharacterStates((current) => ({
        ...current,
        [profileId]: current[profileId] || { node: getOfficePoint(`${occupant.slotId}-home`), moving: false, facing: "right", durationMs: 0, activity: "working", label: "工作中" },
      }));
      const from = characterStates[profileId]?.node || getOfficePoint(`${occupant.slotId}-home`);
      const route = viewport ? createOfficeRoute({ from, destination: activity.destination, viewport }) : [];
      const segments = [...route];
      const advance = () => {
        if (planRun.current !== run) return;
        const segment = segments.shift();
        if (!segment) {
          setCharacterStates((current) => ({ ...current, [profileId]: { ...(current[profileId] || {}), node: getOfficePoint(activity.destination) || from, moving: false, durationMs: 0, activity: activity.activity, label: activity.label } }));
          return;
        }
        setCharacterStates((current) => ({ ...current, [profileId]: { ...(current[profileId] || {}), node: segment.point, moving: true, facing: segment.facing, durationMs: segment.durationMs, activity: "walking", label: activity.priority === "manual" ? activity.label : `前往${activity.label}` } }));
        timers.current.set(profileId, window.setTimeout(advance, segment.durationMs));
      };
      advance();
    });
  }, [plan?.id]);

  useEffect(() => {
    setConversation(null);
    setTurnIndex(0);
    const participants = getRuntimeConversationParticipants(occupants, plan?.conversation?.participantIds || []);
    if (participants.length < 2) return undefined;
    const context = { participants, projectContext, now };
    const fallback = createLocalConversation(context);
    setConversation(fallback);
    const apiState = parseConfigs(window.localStorage.getItem(STORAGE_KEY));
    let cancelled = false;
    generateOfficeConversation({ apiState, context }).then((value) => {
      if (!cancelled) { setConversation(value); dispatch({ type: "CACHE_CONVERSATION", conversation: value }); }
    }).catch((_error) => { dispatch({ type: "CACHE_CONVERSATION", conversation: fallback }); });
    return () => { cancelled = true; };
  }, [plan?.conversation?.id]);

  useEffect(() => {
    if (!conversation?.turns?.length) return undefined;
    const timer = window.setTimeout(() => setTurnIndex((index) => (index + 1) % conversation.turns.length), 6_500);
    return () => window.clearTimeout(timer);
  }, [conversation, turnIndex]);

  const commandMe = (target) => {
    if (!me) return showNotice("请先在员工管理中安排“我 APP”的角色");
    if (!getOfficePoint(target.destination)) return showNotice("这里暂时没有可通行的路线");
    const next = interruptMePlan(plan, me.profile.id, { destination: target.destination, now: Date.now(), label: target.message || "前往指定位置" });
    dispatch({ type: "START_MANUAL_ME", value: next.characters[me.profile.id] });
    setPlan(next);
    if (target.message) window.setTimeout(() => showNotice(target.message, 2000), 300);
  };

  const renderedStates = useMemo(() => {
    const currentTurn = conversation?.turns?.[turnIndex];
    return Object.fromEntries(Object.entries(characterStates).map(([id, value]) => [id, { ...value, bubble: currentTurn?.speakerId === id ? currentTurn.text : "" }]));
  }, [characterStates, conversation, turnIndex]);

  return { characterStates: renderedStates, activeConversation: conversation, commandMe, replanNow: () => setPlan(null) };
}
