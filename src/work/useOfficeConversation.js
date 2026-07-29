import { useEffect, useMemo, useRef, useState } from "react";
import { createLocalConversation, generateOfficeConversation } from "./officeConversation.js";
import {
  advanceConversationTurn,
  appendConversationBatch,
  createConversationSession,
  currentConversationTurn,
  isConversationComplete,
  markConversationRequesting,
  shouldRequestNextBatch,
} from "./officeConversationFlow.js";

export const OFFICE_CONVERSATION_TURN_MS = 6_500;

export function useOfficeConversation({
  ready = false,
  conversationId = "",
  participants = [],
  projectContext = "",
  now = Date.now(),
  apiState,
  dispatch,
  onComplete,
}) {
  const [session, setSession] = useState(createConversationSession);
  const requestRun = useRef(0);
  const completedId = useRef("");
  const inputs = useRef({ participants, projectContext, now, apiState });
  const onCompleteRef = useRef(onComplete);
  inputs.current = { participants, projectContext, now, apiState };
  onCompleteRef.current = onComplete;

  useEffect(() => () => { requestRun.current += 1; }, []);

  const requestBatch = async (history, batchIndex) => {
    const current = inputs.current;
    const context = { participants: current.participants, projectContext: current.projectContext, now: Date.now(), history, batchIndex };
    try {
      return await generateOfficeConversation({ apiState: current.apiState, context });
    } catch {
      return createLocalConversation(context);
    }
  };

  useEffect(() => {
    const run = requestRun.current + 1;
    requestRun.current = run;
    completedId.current = "";
    setSession({ ...createConversationSession(), conversationId, requesting: ready && participants.length >= 2 });
    if (!ready || !conversationId || participants.length < 2) return undefined;
    let cancelled = false;
    requestBatch([], 1).then((batch) => {
      if (cancelled || requestRun.current !== run) return;
      setSession((current) => appendConversationBatch(current, batch));
    });
    return () => { cancelled = true; };
  }, [ready, conversationId]);

  useEffect(() => {
    if (session.conversationId !== conversationId || !shouldRequestNextBatch(session)) return undefined;
    const run = requestRun.current + 1;
    requestRun.current = run;
    const history = session.turns;
    const batchIndex = session.batchIndex + 1;
    setSession((current) => markConversationRequesting(current));
    requestBatch(history, batchIndex).then((batch) => {
      if (requestRun.current !== run) return;
      setSession((current) => appendConversationBatch(current, batch));
    });
    return undefined;
  }, [conversationId, session.batchIndex, session.requesting, session.shouldContinue, session.turnIndex, session.turns.length]);

  const currentTurn = currentConversationTurn(session);

  useEffect(() => {
    if (!currentTurn) return undefined;
    const timer = window.setTimeout(() => setSession((current) => advanceConversationTurn(current)), OFFICE_CONVERSATION_TURN_MS);
    return () => window.clearTimeout(timer);
  }, [conversationId, session.turnIndex, currentTurn?.text]);

  useEffect(() => {
    if (session.conversationId !== conversationId || !isConversationComplete(session) || completedId.current === conversationId) return;
    completedId.current = conversationId;
    onCompleteRef.current?.();
  }, [conversationId, session.requesting, session.shouldContinue, session.turnIndex, session.turns.length]);

  useEffect(() => {
    if (session.conversationId === conversationId && session.turns.length) {
      dispatch?.({ type: "CACHE_CONVERSATION", conversation: { ...session, participantIds: participants.map((item) => item.profile.id) } });
    }
  }, [conversationId, session.batchIndex, session.turns.length]);

  const activeConversation = useMemo(() => (
    session.conversationId === conversationId && session.turns.length
      ? { ...session, participantIds: participants.map((item) => item.profile.id) }
      : null
  ), [conversationId, participants, session]);

  return { activeConversation, currentTurn };
}
