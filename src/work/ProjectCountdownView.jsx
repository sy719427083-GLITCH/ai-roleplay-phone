import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  Clock3,
  FileText,
  Minus,
  PackageCheck,
  ShieldCheck,
  Timer,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { buildStyles, CircularProgressbarWithChildren } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

function formatEndTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "--";
  const time = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`;
}

function formatDifficulty(value) {
  return { 简单: "低", 中等: "中", 困难: "高" }[value] || value;
}

function FactIcon({ className, children }) {
  return <span className={`work-countdown-fact-icon ${className}`} aria-hidden="true">{children}</span>;
}

function CountdownClock({ display }) {
  const [hours = "00", minutes = "00", seconds = "00"] = display.split(":");
  return (
    <div className="work-countdown-clock" aria-label={`剩余时间 ${display}`}>
      <span><strong>{hours}</strong><small>时</small></span>
      <b aria-hidden="true">:</b>
      <span><strong>{minutes}</strong><small>分</small></span>
      <b aria-hidden="true">:</b>
      <span><strong>{seconds}</strong><small>秒</small></span>
    </div>
  );
}

export function ProjectCountdownView({ timer, endsAt, claiming, error, onBack, onOpenProjects, onClaim }) {
  const active = Boolean(timer.project);
  const finished = timer.status === "finished";
  const progressColor = finished ? "#b62d31" : "#e35a50";

  return (
    <section className="work-app-screen work-subpage work-project-countdown-page" aria-label="项目倒计时">
      <header className="work-countdown-header">
        <button type="button" onClick={onBack} aria-label="返回办公室"><ArrowLeft size={24} strokeWidth={2} /></button>
        <h1>项目倒计时</h1>
        <span aria-hidden="true" />
      </header>

      {!active ? (
        <main className="work-countdown-empty">
          <span className="work-countdown-empty-icon"><Timer size={31} /></span>
          <h2>暂无进行中的项目</h2>
          <p>签署一份项目合同后，真实倒计时和完整合同内容会在这里显示。</p>
          <button type="button" onClick={onOpenProjects}><BriefcaseBusiness size={19} />前往项目管理</button>
        </main>
      ) : (
        <>
          <main className={`work-countdown-content is-${timer.status}`}>
            <section className="work-countdown-hero" aria-labelledby="work-countdown-project-name">
              <div className="work-countdown-status">
                <Minus className="work-countdown-status-line" size={15} />
                <Timer className="work-countdown-status-clock" size={16} />
                {finished ? "工作结束" : "项目进行中"}
                <Minus className="work-countdown-status-line" size={15} />
              </div>
              <div className="work-countdown-hero-body">
                <div className="work-countdown-dial" role="progressbar" aria-label="项目完成进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow={timer.progressPercent}>
                  <CircularProgressbarWithChildren
                    value={timer.progressPercent}
                    strokeWidth={4.2}
                    styles={buildStyles({
                      pathColor: progressColor,
                      trailColor: "rgba(81, 102, 146, 0.08)",
                      strokeLinecap: "round",
                      pathTransitionDuration: 0.35,
                    })}
                  >
                    <CountdownClock display={timer.display} />
                  </CircularProgressbarWithChildren>
                </div>

                <div className="work-countdown-project-details">
                  <h2 id="work-countdown-project-name">{timer.project.name}</h2>
                  <dl className="work-countdown-summary">
                    <div>
                      <FactIcon className="is-reward"><ReceiptText size={16} /></FactIcon>
                      <span><dt>合同报酬</dt><dd>{timer.project.amount}</dd></span>
                    </div>
                    <div>
                      <FactIcon className="is-difficulty"><ChartNoAxesColumnIncreasing size={16} /></FactIcon>
                      <span><dt>项目难度</dt><dd>{formatDifficulty(timer.project.difficulty)}</dd></span>
                    </div>
                    <div>
                      <FactIcon className="is-duration"><Clock3 size={16} /></FactIcon>
                      <span><dt>约定工期</dt><dd>{timer.project.duration}</dd></span>
                    </div>
                    <div>
                      <FactIcon className="is-completion"><CalendarDays size={16} /></FactIcon>
                      <span><dt>预计完成</dt><dd>{formatEndTime(endsAt)}</dd></span>
                    </div>
                  </dl>
                </div>
              </div>
            </section>

            <section className="work-countdown-contract" aria-label="合同具体内容">
              <header><h3>合同内容</h3></header>
              <div className="work-countdown-clause is-scope">
                <FactIcon className="is-scope"><FileText size={17} /></FactIcon>
                <div>
                  <h4>一、合同范围</h4>
                  <ol>{timer.project.scopeItems.map((item) => <li key={item}>{item}</li>)}</ol>
                </div>
              </div>
              {timer.project.deliverables && (
                <div className="work-countdown-clause">
                  <FactIcon className="is-delivery"><PackageCheck size={17} /></FactIcon>
                  <div><h4>二、交付物</h4><p>{timer.project.deliverables}</p></div>
                </div>
              )}
              {timer.project.acceptanceCriteria && (
                <div className="work-countdown-clause">
                  <FactIcon className="is-acceptance"><ShieldCheck size={17} /></FactIcon>
                  <div><h4>三、验收标准</h4><p>{timer.project.acceptanceCriteria}</p></div>
                </div>
              )}
              <dl className="work-countdown-contract-facts">
                <div><dt><FactIcon className="is-reward"><BriefcaseBusiness size={16} /></FactIcon>合同报酬</dt><dd>{timer.project.amount}</dd></div>
                <div><dt><FactIcon className="is-duration"><Clock3 size={16} /></FactIcon>约定工期</dt><dd>{timer.project.duration}</dd></div>
                <div><dt><FactIcon className="is-difficulty"><ChartNoAxesColumnIncreasing size={16} /></FactIcon>项目难度</dt><dd>{formatDifficulty(timer.project.difficulty)}</dd></div>
                <div><dt><FactIcon className="is-completion"><CalendarDays size={16} /></FactIcon>预计完成</dt><dd>{formatEndTime(endsAt)}</dd></div>
              </dl>
            </section>
          </main>

          <footer className={`work-countdown-action-bar ${finished ? "is-finished" : "is-running"}`}>
            {finished ? (
              <button type="button" className="work-countdown-fixed-action is-claim" onClick={onClaim} disabled={claiming}>
                <WalletCards size={20} />{claiming ? "正在领取" : "点击领取报酬"}
              </button>
            ) : (
              <button type="button" className="work-countdown-fixed-action is-contract-icon" onClick={onOpenProjects} aria-label="打开完整合同">
                <FileText size={22} />
              </button>
            )}
            {error && <p className="work-reward-error" role="alert">{error}</p>}
          </footer>
        </>
      )}
    </section>
  );
}
