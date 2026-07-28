import { useEffect, useMemo, useRef, useState } from "react";
import { parseConfigs, STORAGE_KEY } from "../apiConfig.js";
import { createLocalConversation, generateAiOfficePlan, generateOfficeConversation } from "./officeConversation.js";
import { OFFICE_ACTIVITY_POINTS, getOfficePoint } from "./officeGeometry.js";
import { createOfficeRoute } from "./officeNavigation.js";
import { allocateOfficeActivities } from "./officeScenePlan.js";
import { createLocalOfficePlan, createOfficeDailySeed, getOfficeIntervalKey } from "./officeSimulation.js";

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
    characters: { ...(plan?.characters || {}), [profileId]: { activity: "walking", label, destination, startsAt: now, endsAt: now + 120_000, priority: "manual" } },
    conversation: participants.length >= 2 ? { ...plan.conversation, participantIds: participants } : null,
  };
}

export function useOfficeSimulation({ occupants, simulation, dispatch, companyName = "office", projectContext = "", sceneRef, now, showNotice }) {
  const [plan, setPlan] = useState(null);
  const [characterStates, setCharacterStates] = useState({});
  const [conversation, setConversation] = useState(null);
  const [turnIndex, setTurnIndex] = useState(0);
  const timers = useRef(new Map());
  const planRun = useRef(0);
  const key = `${getOfficeIntervalKey(new Date(now))}:${simulation.mode}:${occupants.map((item) => `${item.slotId}:${item.profile.id}`).join("|")}`;

  const clearTimers = () => {
    for (const timer of timers.current.values()) window.clearTimeout(timer);
    timers.current.clear();
  };

  useEffect(() => () => { planRun.current += 1; clearTimers(); }, []);

  useEffect(() => {
    const intervalKey = getOfficeIntervalKey(new Date(now));
    const seed = simulation.seed || createOfficeDailySeed(new Date(now), companyName);
    const createPlan = () => allocateOfficeActivities(createLocalOfficePlan({ occupants, now: new Date(now), seed, projectContext, previousPlan: simulation.plan }), occupants);
    const localPlan = deriveCurrentSimulation({ persisted: simulation, intervalKey, occupants, createPlan });
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
      .catch(() => { if (!cancelled) showNotice("AI 导演暂不可用，已使用本地调度"); });
    return () => { cancelled = true; };
  }, [key]);

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
    const participantIds = plan?.conversation?.participantIds || [];
    if (participantIds.length < 2) return undefined;
    const participants = occupants.filter((item) => participantIds.includes(item.profile.id));
    const context = { participants, projectContext, now };
    const fallback = createLocalConversation(context);
    setConversation(fallback);
    const apiState = parseConfigs(window.localStorage.getItem(STORAGE_KEY));
    let cancelled = false;
    generateOfficeConversation({ apiState, context }).then((value) => {
      if (!cancelled) { setConversation(value); dispatch({ type: "CACHE_CONVERSATION", conversation: value }); }
    }).catch(() => { dispatch({ type: "CACHE_CONVERSATION", conversation: fallback }); });
    return () => { cancelled = true; };
  }, [plan?.conversation?.id]);

  useEffect(() => {
    if (!conversation?.turns?.length) return undefined;
    const timer = window.setTimeout(() => setTurnIndex((index) => (index + 1) % conversation.turns.length), 6_500);
    return () => window.clearTimeout(timer);
  }, [conversation, turnIndex]);

  const commandMe = (target) => {
    const me = occupants.find((item) => item.profile.source === "me");
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
