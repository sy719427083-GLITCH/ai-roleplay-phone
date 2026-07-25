export function getActiveWorkProject(state) {
  if (!state?.startedProjectId || !Array.isArray(state.projects)) return null;
  return state.projects.find((project) => project.id === state.startedProjectId) || null;
}

export function formatRemainingTime(seconds) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function deriveProjectTimer(state, now = Date.now()) {
  const project = getActiveWorkProject(state);
  const endMs = Date.parse(state?.endsAt);
  if (!project || !Number.isFinite(endMs)) {
    return { status: "idle", remainingSeconds: null, display: "--:--:--", project: null };
  }
  const remainingSeconds = Math.max(0, Math.ceil((endMs - now) / 1000));
  return {
    status: remainingSeconds === 0 ? "finished" : "running",
    remainingSeconds,
    display: formatRemainingTime(remainingSeconds),
    project,
  };
}

export function createProjectRewardId(state) {
  const project = getActiveWorkProject(state);
  if (!project || typeof state.startedAt !== "string") return null;
  return `work-project:${project.id}:${state.startedAt}`;
}
