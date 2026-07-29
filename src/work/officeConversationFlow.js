import { MAX_OFFICE_CONVERSATION_BATCHES, normalizeOfficeLine } from "./officeConversation.js";

export const createConversationSession = () => ({
  turns: [],
  turnIndex: 0,
  batchIndex: 0,
  shouldContinue: false,
  requesting: false,
});

export function appendConversationBatch(session, batch) {
  const turns = [...session.turns];
  const seen = new Set(turns.map((turn) => normalizeOfficeLine(turn.text)).filter(Boolean));
  let lastSpeakerId = turns.at(-1)?.speakerId || "";
  for (const turn of batch?.turns || []) {
    const key = normalizeOfficeLine(turn?.text);
    if (!turn?.speakerId || !key || seen.has(key) || turn.speakerId === lastSpeakerId) continue;
    turns.push({ speakerId: turn.speakerId, text: turn.text });
    seen.add(key);
    lastSpeakerId = turn.speakerId;
  }
  const batchIndex = Number(batch?.batchIndex) || session.batchIndex + 1;
  return {
    ...session,
    turns,
    batchIndex,
    shouldContinue: Boolean(batch?.shouldContinue) && batchIndex < MAX_OFFICE_CONVERSATION_BATCHES,
    requesting: false,
  };
}

export const currentConversationTurn = (session) => session.turns[session.turnIndex] || null;

export const shouldRequestNextBatch = (session) => (
  session.shouldContinue
  && !session.requesting
  && session.batchIndex < MAX_OFFICE_CONVERSATION_BATCHES
  && session.turnIndex >= Math.max(0, session.turns.length - 2)
);

export const isConversationComplete = (session) => (
  session.turns.length > 0
  && session.turnIndex >= session.turns.length
  && !session.shouldContinue
  && !session.requesting
);

export const advanceConversationTurn = (session) => ({ ...session, turnIndex: session.turnIndex + 1 });
export const markConversationRequesting = (session) => ({ ...session, requesting: true });
