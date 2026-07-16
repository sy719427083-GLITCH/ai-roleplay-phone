import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  ACTIVITY_DEFINITIONS,
  createLocalActivityDetail,
  filterOfficeActivityEvents,
} from "./officeActivities.js";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const formatEventTime = (startedAt) => {
  const date = new Date(Number(startedAt) || 0);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
};

const getDisplayEvent = (event) => {
  const localDetail = createLocalActivityDetail(event);
  const hasDetail = Boolean(event.subject && event.summary && event.insightOrResult);
  return {
    ...event,
    ...(hasDetail ? {} : localDetail),
    isLocal: event.detailStatus === "fallback"
      || !hasDetail
      || (event.subject === localDetail.subject
        && event.summary === localDetail.summary
        && event.insightOrResult === localDetail.insightOrResult),
  };
};

export default function OfficeActivityPanel({
  open,
  events,
  workSessionId,
  assignments,
  onClose,
}) {
  const panelRef = useRef(null);
  const [actorId, setActorId] = useState("");
  const [activityType, setActivityType] = useState("");
  const filteredEvents = useMemo(() => filterOfficeActivityEvents(events, {
    workSessionId,
    actorId,
    activityType,
  }), [activityType, actorId, events, workSessionId]);

  useEffect(() => {
    if (!open || !panelRef.current) return undefined;
    const panel = panelRef.current;
    const frameId = window.requestAnimationFrame(() => {
      panel.querySelector("[data-activity-panel-close]")?.focus();
    });
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
    if (!focusable.length) {
      event.preventDefault();
      panelRef.current.focus();
      return;
    }
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
    <aside
      className="office-activity-overlay"
      aria-label="活动记录"
      aria-modal="true"
      role="dialog"
      tabIndex={-1}
      ref={panelRef}
      onKeyDown={handleKeyDown}
    >
      <section className="office-activity-panel">
        <header className="office-activity-header">
          <div>
            <h2>活动记录</h2>
            <span>当前工作时段</span>
          </div>
          <button
            type="button"
            className="work-icon-button"
            aria-label="关闭活动记录"
            title="关闭"
            data-activity-panel-close="true"
            onClick={onClose}
          >
            <X size={21} strokeWidth={1.9} aria-hidden="true" />
          </button>
        </header>

        <div className="office-activity-filters">
          <label>
            <span>角色</span>
            <select aria-label="按角色筛选" value={actorId} onChange={(event) => setActorId(event.target.value)}>
              <option value="">全部</option>
              {Object.entries(assignments).map(([slotId, assignment]) => (
                <option key={slotId} value={slotId}>{assignment.profile?.name || "NPC"}</option>
              ))}
            </select>
          </label>
          <label>
            <span>活动</span>
            <select aria-label="按活动筛选" value={activityType} onChange={(event) => setActivityType(event.target.value)}>
              <option value="">全部</option>
              {Object.entries(ACTIVITY_DEFINITIONS).map(([type, definition]) => (
                <option key={type} value={type}>{definition.status}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="office-activity-list">
          {filteredEvents.length ? filteredEvents.map((sourceEvent) => {
            const event = getDisplayEvent(sourceEvent);
            const characterName = event.profileSnapshots?.[0]?.name
              || assignments[event.actorId]?.profile?.name
              || event.actorId;
            return (
              <article className="office-activity-entry" key={event.eventId}>
                <header>
                  <time dateTime={new Date(event.startedAt).toISOString()}>{formatEventTime(event.startedAt)}</time>
                  <strong>{characterName}</strong>
                  <span>{event.status || ACTIVITY_DEFINITIONS[event.activityType]?.status}</span>
                </header>
                <h3>{event.subject}</h3>
                <p>{event.summary}</p>
                <p className="office-activity-insight">{event.insightOrResult}</p>
                <footer>
                  {!event.endedAt && <span>进行中</span>}
                  {event.isLocal && <span>本地记录</span>}
                </footer>
              </article>
            );
          }) : <p className="office-activity-empty">暂无活动记录</p>}
        </div>
      </section>
    </aside>
  );
}
