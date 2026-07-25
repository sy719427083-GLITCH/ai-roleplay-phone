import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Building2, ChevronLeft } from "lucide-react";
import {
  WORK_COMPANY_MAX_PREFIX_LENGTH,
  WORK_COMPANY_SUFFIX,
  limitWorkCompanyPrefix,
  normalizeWorkCompanyPrefix,
} from "./workCompanyState.js";

const LAUNCH_DURATION_MS = 1200;
const ENTER_DURATION_MS = 1400;
const REDUCED_DURATION_MS = 150;

export function WorkCompanyOnboarding({ onClose, onCreate, onComplete }) {
  const [phase, setPhase] = useState("launch");
  const [prefix, setPrefix] = useState("");
  const [limitMessage, setLimitMessage] = useState("");
  const [error, setError] = useState("");
  const [createdCompany, setCreatedCompany] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const reducedMotion = useMemo(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    [],
  );
  const normalizedPrefix = normalizeWorkCompanyPrefix(prefix);

  useEffect(() => {
    if (phase !== "launch") return undefined;
    const duration = reducedMotion ? REDUCED_DURATION_MS : LAUNCH_DURATION_MS;
    const timer = window.setTimeout(() => setPhase("create"), duration);
    return () => window.clearTimeout(timer);
  }, [phase, reducedMotion]);

  useEffect(() => {
    if (phase !== "enter" || !createdCompany) return undefined;
    const duration = reducedMotion ? REDUCED_DURATION_MS : ENTER_DURATION_MS;
    const timer = window.setTimeout(() => onComplete(createdCompany), duration);
    return () => window.clearTimeout(timer);
  }, [phase, createdCompany, onComplete, reducedMotion]);

  const updatePrefix = (value) => {
    const oversized = Array.from(value).length > WORK_COMPANY_MAX_PREFIX_LENGTH;
    setPrefix(limitWorkCompanyPrefix(value));
    setLimitMessage(oversized ? "公司名称最多 5 个字" : "");
    setError("");
  };

  const submit = () => {
    if (!normalizedPrefix || submitting) return;
    setSubmitting(true);
    try {
      const company = onCreate(normalizedPrefix);
      setCreatedCompany(company);
      setPhase("enter");
    } catch {
      setError("公司创建失败，请重试");
      setSubmitting(false);
    }
  };

  if (phase === "launch") {
    return (
      <section className="work-company-onboarding is-launch" aria-label="工作 APP 启动">
        <button className="work-company-skip" type="button" onClick={() => setPhase("create")}>跳过动画</button>
        <div className="work-company-launch-center">
          <span className="work-company-launch-glow" aria-hidden="true" />
          <span className="work-company-launch-icon"><BriefcaseBusiness size={42} /></span>
          <strong>工作中心</strong>
          <span>CCAT WORK</span>
        </div>
      </section>
    );
  }

  if (phase === "enter") {
    return (
      <section className="work-company-onboarding is-enter" aria-label="正在进入公司">
        <button className="work-company-skip" type="button" onClick={() => onComplete(createdCompany)}>跳过动画</button>
        <div className="work-company-enter-center">
          <div className="work-company-entry" aria-hidden="true">
            <span className="work-company-entry-door is-left" />
            <span className="work-company-entry-door is-right" />
            <Building2 size={46} />
          </div>
          <strong className="work-company-plaque">{createdCompany.fullName}</strong>
          <span className="work-company-enter-label">正在进入公司</span>
        </div>
      </section>
    );
  }

  const fullName = normalizedPrefix ? `${normalizedPrefix}${WORK_COMPANY_SUFFIX}` : WORK_COMPANY_SUFFIX;
  return (
    <section className="work-company-onboarding is-create" aria-label="创建公司">
      <button className="work-company-close" type="button" onClick={onClose} aria-label="返回主页"><ChevronLeft size={22} /></button>
      <form className="work-company-create-card" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <span className="work-company-create-icon"><Building2 size={28} /></span>
        <p className="work-company-eyebrow">CREATE YOUR COMPANY</p>
        <h1>创建公司</h1>
        <p className="work-company-intro">为你的工作空间取一个名字</p>
        <label className="work-company-name-field">
          <input
            autoFocus
            aria-label="公司名称前缀"
            value={prefix}
            onChange={(event) => updatePrefix(event.target.value)}
            placeholder="最多 5 个字"
          />
          <span aria-label="固定后缀有限公司">{WORK_COMPANY_SUFFIX}</span>
        </label>
        <div className="work-company-preview" aria-live="polite">
          <small>公司全称</small>
          <strong>{fullName}</strong>
        </div>
        <div className="work-company-feedback">
          {limitMessage && <p className="work-company-message">{limitMessage}</p>}
          {error && <p className="work-company-error" role="alert">{error}</p>}
        </div>
        <button className="work-company-create-button" type="submit" disabled={!normalizedPrefix || submitting}>
          {submitting ? "正在创建" : "创建公司"}
        </button>
      </form>
    </section>
  );
}
