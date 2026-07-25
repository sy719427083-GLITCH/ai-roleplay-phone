import { normalizeWorkProject } from "./workProjectContract.js";

export const WORK_PROJECTS_STORAGE_KEY = "ccatWorkProjectsV1";

const SOURCES = new Set(["secondary", "main"]);

export function createEmptyWorkProjectState() {
  return {
    projects: [], startedProjectId: null, startedAt: null, endsAt: null,
    revision: 0, source: null, generatedAt: null,
  };
}

function normalizeProjects(projects) {
  if (!Array.isArray(projects) || projects.length !== 5) return null;
  const normalized = projects.map((project) => normalizeWorkProject(project));
  if (normalized.some((project) => !project) || new Set(normalized.map((project) => project.id)).size !== 5) return null;
  return normalized;
}

function validRevision(value) {
  return Number.isInteger(value) && value >= 0;
}

export function restoreWorkProjectState(raw, now = Date.now()) {
  if (!raw) return createEmptyWorkProjectState();
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.projects) && parsed.projects.length === 0) {
      if (parsed.startedProjectId != null || parsed.startedAt != null || parsed.endsAt != null || !validRevision(parsed.revision ?? 0)) {
        return createEmptyWorkProjectState();
      }
      return { ...createEmptyWorkProjectState(), revision: parsed.revision ?? 0 };
    }

    const projects = normalizeProjects(parsed.projects);
    const validGeneratedAt = parsed.generatedAt === null || typeof parsed.generatedAt === "string";
    if (!projects || !SOURCES.has(parsed.source) || !validRevision(parsed.revision) || !validGeneratedAt) {
      return createEmptyWorkProjectState();
    }

    if (parsed.startedProjectId === null) {
      if (parsed.startedAt != null || parsed.endsAt != null) return createEmptyWorkProjectState();
      return { projects, startedProjectId: null, startedAt: null, endsAt: null, revision: parsed.revision, source: parsed.source, generatedAt: parsed.generatedAt };
    }

    const activeProject = projects.find((project) => project.id === parsed.startedProjectId);
    if (!activeProject) return createEmptyWorkProjectState();
    let startedAt = parsed.startedAt;
    let endsAt = parsed.endsAt;
    if (startedAt == null && endsAt == null) {
      if (!Number.isFinite(now)) return createEmptyWorkProjectState();
      startedAt = new Date(now).toISOString();
      endsAt = new Date(now + activeProject.durationHours * 60 * 60 * 1000).toISOString();
    } else if (typeof startedAt !== "string" || typeof endsAt !== "string") {
      return createEmptyWorkProjectState();
    }
    const startMs = Date.parse(startedAt);
    const endMs = Date.parse(endsAt);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return createEmptyWorkProjectState();
    return {
      projects,
      startedProjectId: parsed.startedProjectId,
      startedAt: new Date(startMs).toISOString(),
      endsAt: new Date(endMs).toISOString(),
      revision: parsed.revision,
      source: parsed.source,
      generatedAt: parsed.generatedAt,
    };
  } catch {
    return createEmptyWorkProjectState();
  }
}

export function replaceWorkProjects(state, projects, source, generatedAt = new Date().toISOString()) {
  const normalized = normalizeProjects(projects);
  if (!normalized || !SOURCES.has(source) || state.startedProjectId) return state;
  return {
    projects: normalized,
    startedProjectId: null,
    startedAt: null,
    endsAt: null,
    revision: (validRevision(state.revision) ? state.revision : 0) + 1,
    source,
    generatedAt,
  };
}

export function startWorkProject(state, projectId, now = Date.now()) {
  const project = state.projects.find((item) => item.id === projectId);
  if (state.startedProjectId || !project || !Number.isFinite(now)) return state;
  return {
    ...state,
    startedProjectId: projectId,
    startedAt: new Date(now).toISOString(),
    endsAt: new Date(now + project.durationHours * 60 * 60 * 1000).toISOString(),
  };
}

export function clearCompletedWorkProject(state, now = Date.now()) {
  const endMs = Date.parse(state.endsAt);
  if (!state.startedProjectId || !Number.isFinite(endMs) || now < endMs) return state;
  return { ...createEmptyWorkProjectState(), revision: validRevision(state.revision) ? state.revision : 0 };
}

export function serializeWorkProjectState(state) {
  return JSON.stringify({
    projects: state.projects,
    startedProjectId: state.startedProjectId,
    startedAt: state.startedAt,
    endsAt: state.endsAt,
    revision: state.revision,
    source: state.source,
    generatedAt: state.generatedAt,
  });
}
