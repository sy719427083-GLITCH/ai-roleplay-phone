import { useEffect, useRef, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { STORAGE_KEY, parseConfigs } from "../apiConfig.js";
import { generateWorkProjects } from "./workProjectApi.js";
import {
  replaceWorkProjects,
  startWorkProject,
} from "./workProjectState.js";

export function ProjectManagementPreview({ onBack, projectState, onProjectStateChange }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestedOnEntry = useRef(false);
  const stateRef = useRef(projectState);
  const locked = Boolean(projectState.startedProjectId);
  const refreshing = loading && projectState.projects.length === 5;

  useEffect(() => {
    stateRef.current = projectState;
  }, [projectState]);

  useEffect(() => {
    if (requestedOnEntry.current || stateRef.current.projects.length === 5) return;
    requestedOnEntry.current = true;
    void loadContracts();
  }, []);

  async function loadContracts() {
    setLoading(true);
    setError("");
    try {
      const apiState = parseConfigs(window.localStorage.getItem(STORAGE_KEY));
      const result = await generateWorkProjects({ apiState, revision: stateRef.current.revision });
      const nextState = replaceWorkProjects(stateRef.current, result.projects, result.source);
      stateRef.current = nextState;
      onProjectStateChange(nextState);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "合同生成失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  function handleRefresh() {
    if (locked || refreshing) return;
    void loadContracts();
  }

  function handleStart(projectId) {
    const nextState = startWorkProject(stateRef.current, projectId, Date.now());
    stateRef.current = nextState;
    onProjectStateChange(nextState);
  }

  return (
    <section className="work-app-screen work-projects-page" aria-label="项目管理">
      <header className="work-projects-header">
        <button type="button" className="work-projects-back" onClick={onBack} aria-label="返回工作室">
          <ArrowLeft size={21} strokeWidth={2.2} />
        </button>
        <div className="work-projects-title-block">
          <span className="work-projects-kicker">CCAT CONTRACTS</span>
          <h1>项目合同</h1>
        </div>
        <button
          type="button"
          className={`work-projects-refresh${refreshing ? " is-refreshing" : ""}`}
          onClick={handleRefresh}
          disabled={locked || loading}
          aria-label={locked ? "合同已签署，无法换一批" : loading ? "正在更换合同" : "换一批合同"}
        >
          <RefreshCw size={17} strokeWidth={2.2} />
          <span>{locked ? "已锁定" : loading ? "更换中" : "换一批"}</span>
        </button>
      </header>

      <main className="work-projects-content">
        <div className={`work-projects-summary${locked ? " is-locked" : ""}`} aria-live="polite">
          <div>
            <strong>{locked ? "合同已生效，本批合同已锁定" : `待签署合同 ${projectState.projects.length} 份`}</strong>
            <span>{locked ? "当前合同执行完毕后可获取新合同" : projectState.source ? `${projectState.source === "secondary" ? "副 API" : "主 API"} 生成 · 请审阅后签署` : "正在连接项目中心"}</span>
          </div>
          <span className="work-projects-count" aria-hidden="true">{locked ? "生效" : "待签"}</span>
        </div>

        {loading && projectState.projects.length === 0 ? (
          <div className="work-projects-list" aria-label="正在生成项目" aria-busy="true">
            {Array.from({ length: 5 }).map((_, index) => <ProjectSkeleton key={index} />)}
          </div>
        ) : error && projectState.projects.length === 0 ? (
          <div className="work-projects-error" role="alert">
            <strong>暂时无法生成合同</strong>
            <p>{error}</p>
            <button type="button" onClick={loadContracts} disabled={loading}>重新尝试</button>
          </div>
        ) : (
          <>
            {error && <div className="work-projects-inline-error" role="alert">{error}，原合同已保留。</div>}
            <div className="work-projects-list" key={projectState.revision} aria-busy={refreshing}>
              {projectState.projects.map((project, index) => {
                const isStarted = projectState.startedProjectId === project.id;
                const isMuted = locked && !isStarted;
                const contractNumber = `CCAT-2026-${String(projectState.revision * 5 + index + 1).padStart(3, "0")}`;
                return (
                  <article className={`work-project-card${isStarted ? " is-started" : ""}${isMuted ? " is-muted" : ""}`} key={project.id}>
                    <div className="work-contract-heading">
                      <span className="work-contract-number">合同编号 {contractNumber}</span>
                      <h2>{project.name}</h2>
                      {isStarted && <span className="work-contract-seal">已签署<small>今日生效</small></span>}
                    </div>

                    <dl className="work-contract-parties">
                      <div><dt>委托方（甲方）</dt><dd>CCAT 工作中心</dd></div>
                      <div><dt>承接方（乙方）</dt><dd>{isStarted ? "已确认承接" : "待签署"}</dd></div>
                    </dl>

                    <dl className="work-contract-terms">
                      <div><dt>合同总额</dt><dd>人民币 {project.amount}</dd></div>
                      <div><dt>交付期限</dt><dd>{project.duration}</dd></div>
                      <div><dt>难度等级</dt><dd>{project.difficulty}</dd></div>
                    </dl>

                    <section className="work-contract-scope">
                      <h3>第一条 · 项目内容</h3>
                      <p>{project.description}</p>
                    </section>

                    <div className="work-contract-signatures" aria-label="合同签章区">
                      <span>甲方签章</span><span>乙方签章</span>
                    </div>

                    <button type="button" className="work-project-start" onClick={() => handleStart(project.id)} disabled={locked}>
                      <span>{isStarted ? "合同执行中" : locked ? "本合同不可签署" : "签署合同并开始"}</span>
                      <span aria-hidden="true">{isStarted ? "IN FORCE" : locked ? "LOCKED" : "SIGN →"}</span>
                    </button>
                  </article>
                );
              })}
            </div>
          </>
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
