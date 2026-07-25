import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock3, FileText, RefreshCw, WalletCards } from "lucide-react";
import {
  createProjectPreviewState,
  refreshPreviewProjects,
  startPreviewProject,
} from "./projectPreviewModel.js";

const DIFFICULTY_CLASS = {
  简单: "is-easy",
  中等: "is-medium",
  困难: "is-hard",
};

export function ProjectManagementPreview({ onBack }) {
  const [previewState, setPreviewState] = useState(createProjectPreviewState);
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimer = useRef(null);
  const locked = Boolean(previewState.startedProjectId);

  useEffect(() => () => window.clearTimeout(refreshTimer.current), []);

  function handleRefresh() {
    if (locked || refreshing) return;
    setRefreshing(true);
    refreshTimer.current = window.setTimeout(() => {
      setPreviewState((current) => refreshPreviewProjects(current));
      setRefreshing(false);
    }, 650);
  }

  function handleStart(projectId) {
    setPreviewState((current) => startPreviewProject(current, projectId));
  }

  return (
    <section className="work-app-screen work-projects-page">
      <header className="work-projects-header">
        <button type="button" className="work-projects-back" onClick={onBack} aria-label="返回工作室">
          <ArrowLeft size={21} strokeWidth={2.2} />
        </button>
        <h1>项目管理</h1>
        <button
          type="button"
          className={`work-projects-refresh${refreshing ? " is-refreshing" : ""}`}
          onClick={handleRefresh}
          disabled={locked || refreshing}
          aria-label={locked ? "项目进行中，无法刷新" : refreshing ? "正在刷新项目" : "刷新项目"}
        >
          <RefreshCw size={20} strokeWidth={2.2} />
        </button>
      </header>

      <main className="work-projects-content">
        <div className={`work-projects-summary${locked ? " is-locked" : ""}`} aria-live="polite">
          <span className="work-projects-summary-dot" aria-hidden="true" />
          <div>
            <strong>{locked ? "项目进行中 · 列表已锁定" : `今日可接 ${previewState.projects.length} 个项目`}</strong>
            <span>{locked ? "完成当前项目后可获取新项目" : "选择适合你的项目，开始今天的工作"}</span>
          </div>
        </div>

        {refreshing ? (
          <div className="work-projects-list" aria-label="正在刷新项目" aria-busy="true">
            {Array.from({ length: 5 }).map((_, index) => <ProjectSkeleton key={index} />)}
          </div>
        ) : (
          <div className="work-projects-list" key={previewState.revision}>
            {previewState.projects.map((project, index) => {
              const isStarted = previewState.startedProjectId === project.id;
              return (
                <article className={`work-project-card${isStarted ? " is-started" : ""}`} key={project.id}>
                  <div className="work-project-card-accent" data-tone={index % 4} aria-hidden="true" />
                  <div className="work-project-card-heading">
                    <div>
                      <span className="work-project-eyebrow">工作项目 {String(index + 1).padStart(2, "0")}</span>
                      <h2>{project.name}</h2>
                    </div>
                    <span className={`work-project-difficulty ${DIFFICULTY_CLASS[project.difficulty] || "is-medium"}`}>
                      {project.difficulty}
                    </span>
                  </div>

                  <div className="work-project-meta">
                    <div>
                      <Clock3 size={17} aria-hidden="true" />
                      <span>项目时间<strong>{project.duration}</strong></span>
                    </div>
                    <div>
                      <WalletCards size={17} aria-hidden="true" />
                      <span>项目金额<strong>{project.amount}</strong></span>
                    </div>
                  </div>

                  <div className="work-project-description">
                    <FileText size={16} aria-hidden="true" />
                    <p><span>项目内容</span>{project.description}</p>
                  </div>

                  <button
                    type="button"
                    className="work-project-start"
                    onClick={() => handleStart(project.id)}
                    disabled={locked}
                  >
                    {isStarted ? "项目进行中" : locked ? "已有项目进行中" : "开始项目"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </section>
  );
}

function ProjectSkeleton() {
  return (
    <div className="work-project-card work-project-skeleton" aria-hidden="true">
      <span className="skeleton-line is-short" />
      <span className="skeleton-line is-title" />
      <div className="skeleton-meta"><span /><span /></div>
      <span className="skeleton-line" />
      <span className="skeleton-line is-button" />
    </div>
  );
}
