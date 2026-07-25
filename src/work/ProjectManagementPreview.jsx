import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock3, FileText, RefreshCw } from "lucide-react";
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
    <section className="work-app-screen work-projects-page" aria-label="项目管理">
      <header className="work-projects-header">
        <button type="button" className="work-projects-back" onClick={onBack} aria-label="返回工作室">
          <ArrowLeft size={21} strokeWidth={2.2} />
        </button>
        <div className="work-projects-title-block">
          <span className="work-projects-kicker">WORK BOARD</span>
          <h1>今日项目</h1>
        </div>
        <button
          type="button"
          className={`work-projects-refresh${refreshing ? " is-refreshing" : ""}`}
          onClick={handleRefresh}
          disabled={locked || refreshing}
          aria-label={locked ? "项目进行中，无法刷新" : refreshing ? "正在刷新项目" : "刷新项目"}
        >
          <RefreshCw size={17} strokeWidth={2.2} />
          <span>{locked ? "进行中" : refreshing ? "刷新中" : "刷新"}</span>
        </button>
      </header>

      <main className="work-projects-content">
        <div className={`work-projects-summary${locked ? " is-locked" : ""}`} aria-live="polite">
          <div>
            <strong>{locked ? "项目进行中，今日列表已锁定" : `${previewState.projects.length} 个新项目等待认领`}</strong>
            <span>{locked ? "完成当前项目后可获取新项目" : "选择一项工作，开始今天的创作"}</span>
          </div>
          <span className="work-projects-count" aria-hidden="true">{locked ? "LOCKED" : "05 / 05"}</span>
        </div>

        {refreshing ? (
          <div className="work-projects-list" aria-label="正在刷新项目" aria-busy="true">
            {Array.from({ length: 5 }).map((_, index) => <ProjectSkeleton key={index} />)}
          </div>
        ) : (
          <div className="work-projects-list" key={previewState.revision}>
            {previewState.projects.map((project, index) => {
              const isStarted = previewState.startedProjectId === project.id;
              const isMuted = locked && !isStarted;
              return (
                <article className={`work-project-card${isStarted ? " is-started" : ""}${isMuted ? " is-muted" : ""}`} key={project.id}>
                  <div className="work-project-card-heading">
                    <span className="work-project-eyebrow">ASSIGNMENT / {String(index + 1).padStart(2, "0")}</span>
                    <span className={`work-project-difficulty ${DIFFICULTY_CLASS[project.difficulty] || "is-medium"}`}>
                      {project.difficulty}
                    </span>
                  </div>

                  <div className="work-project-title-row">
                    <h2>{project.name}</h2>
                    <div className="work-project-price">
                      <span>项目金额</span>
                      <strong>{project.amount}</strong>
                    </div>
                  </div>

                  <div className="work-project-ticket-meta">
                    <span><Clock3 size={15} aria-hidden="true" />项目时间 <strong>{project.duration}</strong></span>
                    <span>难度 / <strong>{project.difficulty}</strong></span>
                  </div>

                  <div className="work-project-description">
                    <FileText size={15} aria-hidden="true" />
                    <p><span>项目内容</span>{project.description}</p>
                  </div>

                  <button
                    type="button"
                    className="work-project-start"
                    onClick={() => handleStart(project.id)}
                    disabled={locked}
                  >
                    <span>{isStarted ? "项目进行中" : locked ? "已有项目进行中" : "开始项目"}</span>
                    <span aria-hidden="true">{isStarted ? "ACTIVE" : locked ? "LOCKED" : "START →"}</span>
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
