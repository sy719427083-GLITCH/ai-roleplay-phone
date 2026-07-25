export const WORK_PROJECTS_STORAGE_KEY = "ccatWorkProjectsV1";

const SOURCES = new Set(["secondary", "main"]);
const DIFFICULTIES = new Set(["简单", "中等", "困难"]);

export function createEmptyWorkProjectState() {
  return { projects: [], startedProjectId: null, revision: 0, source: null, generatedAt: null };
}

function isValidProject(project) {
  return project && ["id", "name", "duration", "amount", "description", "difficulty"]
    .every((key) => typeof project[key] === "string" && project[key].trim())
    && DIFFICULTIES.has(project.difficulty);
}

function isValidProjects(projects) {
  return Array.isArray(projects)
    && projects.length === 5
    && projects.every(isValidProject)
    && new Set(projects.map((project) => project.id)).size === 5;
}

export function restoreWorkProjectState(raw) {
  if (!raw) return createEmptyWorkProjectState();
  try {
    const parsed = JSON.parse(raw);
    const validStartedId = parsed.startedProjectId === null
      || (typeof parsed.startedProjectId === "string" && parsed.projects?.some((project) => project.id === parsed.startedProjectId));
    const validGeneratedAt = parsed.generatedAt === null || typeof parsed.generatedAt === "string";
    if (!isValidProjects(parsed.projects) || !SOURCES.has(parsed.source) || !validStartedId
      || !Number.isInteger(parsed.revision) || parsed.revision < 0 || !validGeneratedAt) {
      return createEmptyWorkProjectState();
    }
    return {
      projects: parsed.projects.map((project) => ({ ...project })),
      startedProjectId: parsed.startedProjectId,
      revision: parsed.revision,
      source: parsed.source,
      generatedAt: parsed.generatedAt,
    };
  } catch {
    return createEmptyWorkProjectState();
  }
}

export function replaceWorkProjects(state, projects, source, generatedAt = new Date().toISOString()) {
  if (!isValidProjects(projects) || !SOURCES.has(source)) return state;
  return {
    projects: projects.map((project) => ({ ...project })),
    startedProjectId: null,
    revision: (Number.isInteger(state.revision) ? state.revision : 0) + 1,
    source,
    generatedAt,
  };
}

export function startWorkProject(state, projectId) {
  if (state.startedProjectId || !state.projects.some((project) => project.id === projectId)) return state;
  return { ...state, startedProjectId: projectId };
}

export function serializeWorkProjectState(state) {
  return JSON.stringify({
    projects: state.projects,
    startedProjectId: state.startedProjectId,
    revision: state.revision,
    source: state.source,
    generatedAt: state.generatedAt,
  });
}
