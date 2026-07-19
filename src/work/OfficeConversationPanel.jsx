import { useEffect, useMemo, useRef } from "react";
import { X } from "lucide-react";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const asTime = (timestamp) => {
  const date = new Date(Number(timestamp));
  if (Number.isNaN(date.getTime())) return { dateTime: undefined, label: "--:--" };
  return {
    dateTime: date.toISOString(),
    label: date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
  };
};

const participantNames = (conversation) => {
  const snapshotNames = Array.isArray(conversation.participantSnapshots)
    ? conversation.participantSnapshots.map((snapshot) => snapshot?.name || snapshot?.memberId).filter(Boolean) : [];
  return snapshotNames.length ? snapshotNames : (conversation.memberIds || []);
};

const toDisplayConversation = (conversation, active) => ({
  ...conversation,
  active,
  transcript: Array.isArray(conversation.transcript) ? conversation.transcript : [],
  participantNames: participantNames(conversation),
});

export default function OfficeConversationPanel({ open, activeConversations = {}, conversationRecords = [], onClose }) {
  const panelRef = useRef(null);
  const conversations = useMemo(() => [
    ...Object.values(activeConversations).map((conversation) => toDisplayConversation(conversation, true)),
    ...conversationRecords.map((conversation) => toDisplayConversation(conversation, false)),
  ], [activeConversations, conversationRecords]);

  useEffect(() => {
    if (!open || !panelRef.current) return undefined;
    const panel = panelRef.current;
    const frameId = window.requestAnimationFrame(() => panel.querySelector("[data-conversation-panel-close]")?.focus());
    return () => window.cancelAnimationFrame(frameId);
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR)];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <aside className="office-activity-overlay" aria-label="对话记录" aria-modal="true" role="dialog" tabIndex={-1} ref={panelRef} onKeyDown={handleKeyDown}>
      <section className="office-activity-panel">
        <header className="office-activity-header">
          <h2>对话记录</h2>
          <button type="button" className="work-icon-button" aria-label="关闭对话记录" title="关闭" data-conversation-panel-close="true" onClick={onClose}>
            <X size={21} strokeWidth={1.9} aria-hidden="true" />
          </button>
        </header>
        <div className="office-activity-list">
          {conversations.length ? conversations.map((conversation) => {
            const time = asTime(conversation.active ? conversation.startedAt : conversation.endedAt);
            const names = Object.fromEntries((conversation.participantSnapshots || []).map((snapshot) => [snapshot.memberId, snapshot.name || snapshot.memberId]));
            return (
              <article className="office-activity-entry" key={conversation.conversationId || conversation.id}>
                <header>
                  <time dateTime={time.dateTime}>{time.label}</time>
                  <strong>{conversation.locationId || conversation.sceneId}</strong>
                  {conversation.active && <span>进行中</span>}
                </header>
                <h3>{conversation.topic}</h3>
                <p>{conversation.participantNames.join("、")}</p>
                {conversation.transcript.map((entry, index) => (
                  <p key={`${entry.speakerId}-${index}`}><strong>{names[entry.speakerId] || entry.speakerId}</strong>{`：${entry.text}`}</p>
                ))}
              </article>
            );
          }) : <p className="office-activity-empty">暂无对话记录</p>}
        </div>
      </section>
    </aside>
  );
}
