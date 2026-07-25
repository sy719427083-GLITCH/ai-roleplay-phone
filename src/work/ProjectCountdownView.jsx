import { ArrowLeft, BriefcaseBusiness, Clock3, Timer, WalletCards } from "lucide-react";

function formatEndTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "--";
  return date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function ProjectCountdownView({ timer, endsAt, claiming, error, onBack, onOpenProjects, onClaim }) {
  const active = Boolean(timer.project);
  const finished = timer.status === "finished";
  return (
    <section className="work-app-screen work-subpage work-project-countdown-page" aria-label="项目倒计时">
      <header className="work-page-header">
        <button type="button" onClick={onBack} aria-label="返回办公室"><ArrowLeft size={21} /></button>
        <h1>项目倒计时</h1>
        <span />
      </header>

      {!active ? (
        <main className="work-countdown-empty">
          <span className="work-countdown-empty-icon"><Timer size={30} /></span>
          <h2>暂无进行中的项目</h2>
          <p>签署一份项目合同后，真实倒计时会在这里开始。</p>
          <button type="button" onClick={onOpenProjects}><BriefcaseBusiness size={18} />前往项目管理</button>
        </main>
      ) : (
        <main className={`work-countdown-content is-${timer.status}`}>
          <span className="work-countdown-status">{finished ? "工作结束" : "项目进行中"}</span>
          <div className="work-countdown-clock" aria-label={`剩余时间 ${timer.display}`}>{timer.display}</div>
          <p className="work-countdown-caption">{finished ? "项目已按时完成，请领取合同报酬" : "REAL-TIME PROJECT COUNTDOWN"}</p>

          <section className="work-countdown-contract">
            <span>当前合同</span>
            <h2>{timer.project.name}</h2>
            <dl className="work-countdown-meta">
              <div><dt><WalletCards size={14} />合同报酬</dt><dd>{timer.project.amount}</dd></div>
              <div><dt><Clock3 size={14} />约定工期</dt><dd>{timer.project.duration}</dd></div>
              <div><dt><Timer size={14} />预计结束</dt><dd>{formatEndTime(endsAt)}</dd></div>
            </dl>
          </section>

          {finished && (
            <button type="button" className="work-reward-claim" onClick={onClaim} disabled={claiming}>
              <WalletCards size={19} />{claiming ? "正在领取" : "点击领取报酬"}
            </button>
          )}
          {error && <p className="work-reward-error" role="alert">{error}</p>}
        </main>
      )}
    </section>
  );
}
