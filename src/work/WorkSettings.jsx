import { useState } from "react";
import { Bot, ChevronLeft, Database, Sparkles, Trash2, X } from "lucide-react";
import { clearWorkCache } from "./workCache.js";

export function WorkSettings({ simulationMode = "local", onSimulationModeChange = () => {}, onTestAiDirector = async () => {}, onBack, onCleared }) {
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");
  const [testingAi, setTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState(null);

  const runAiTest = async () => {
    if (testingAi) return;
    setTestingAi(true);
    setAiTestResult(null);
    try {
      await onTestAiDirector();
      setAiTestResult({ tone: "ok", text: "AI 导演连接成功，可以使用。" });
    } catch (testError) {
      setAiTestResult({ tone: "error", text: testError instanceof Error ? testError.message : "AI 导演测试失败" });
    } finally {
      setTestingAi(false);
    }
  };

  const confirmClear = () => {
    if (clearing) return;
    setClearing(true);
    setError("");

    try {
      clearWorkCache(window.localStorage);
      setConfirming(false);
      onCleared();
    } catch {
      setConfirming(false);
      setClearing(false);
      setError("清除失败，请重试");
    }
  };

  return (
    <section className="work-app-screen work-subpage work-settings-page">
      <header className="work-page-header">
        <button type="button" onClick={onBack} aria-label="返回办公室">
          <ChevronLeft size={21} />
        </button>
        <h1>工作设置</h1>
        <span />
      </header>

      <main className="work-settings-content">
        <section className="work-settings-section work-mode-section">
          <span className="work-settings-icon"><Sparkles size={22} /></span>
          <div>
            <h2>自主行为模式</h2>
            <p>决定办公室人物如何安排工作、聊天与休息</p>
          </div>
          <div className="work-mode-options" role="radiogroup" aria-label="自主行为模式">
            <button type="button" role="radio" aria-checked={simulationMode === "local"} className={`work-mode-option ${simulationMode === "local" ? "is-selected" : ""}`} onClick={() => onSimulationModeChange("local")}>
              <Sparkles size={18} /><span><strong>A 本地调度（推荐）</strong><small>本地安排行为，仅聊天时调用 AI</small></span>
            </button>
            <button type="button" role="radio" aria-checked={simulationMode === "ai"} className={`work-mode-option ${simulationMode === "ai" ? "is-selected" : ""}`} onClick={() => onSimulationModeChange("ai")}>
              <Bot size={18} /><span><strong>B AI 导演</strong><small>AI 规划整段办公室场景</small></span>
            </button>
          </div>
          <p className="work-mode-note">AI 不可用时自动使用本地调度</p>
          <div className="work-ai-test-panel">
            <div>
              <strong>连接诊断</strong>
              <small>使用当前主 API 测试真实办公室场景</small>
            </div>
            <button className="work-ai-test-button" type="button" onClick={runAiTest} disabled={testingAi}>
              <Bot size={17} />
              {testingAi ? "测试中…" : "测试 AI 导演"}
            </button>
            {aiTestResult?.tone === "ok" && <p className="work-ai-test-result is-ok" role="status">{aiTestResult.text}</p>}
            {aiTestResult?.tone === "error" && <p className="work-ai-test-result is-error" role="alert">{aiTestResult.text}</p>}
          </div>
        </section>
        <section className="work-settings-section">
          <span className="work-settings-icon"><Database size={22} /></span>
          <div>
            <h2>存储与重置</h2>
            <p>清除公司、办公室安排和项目进度，其他 APP 数据不会受到影响</p>
          </div>
          <button
            className="work-settings-clear"
            type="button"
            onClick={() => {
              setError("");
              setConfirming(true);
            }}
          >
            <Trash2 size={18} />
            清除工作缓存
          </button>
          {error && <p className="work-settings-error" role="alert">{error}</p>}
        </section>
      </main>

      {confirming && (
        <div className="work-cache-confirm-backdrop" onClick={() => setConfirming(false)}>
          <section
            className="work-cache-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="work-cache-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="work-cache-confirm-close"
              type="button"
              onClick={() => setConfirming(false)}
              aria-label="关闭确认"
            >
              <X size={20} />
            </button>
            <h2 id="work-cache-confirm-title">清除工作缓存？</h2>
            <p>公司名称、员工安排、项目列表和倒计时会被删除。</p>
            <strong>钱包、API 和角色资料不会被删除</strong>
            <div className="work-cache-confirm-actions">
              <button
                className="work-cache-confirm-action is-cancel"
                type="button"
                onClick={() => setConfirming(false)}
              >
                取消
              </button>
              <button
                className="work-cache-confirm-action is-danger"
                type="button"
                onClick={confirmClear}
                disabled={clearing}
              >
                {clearing ? "正在清除" : "确认清除"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
