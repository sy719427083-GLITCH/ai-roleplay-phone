import { useState } from "react";
import { ChevronLeft, Database, Trash2, X } from "lucide-react";
import { clearWorkCache } from "./workCache.js";

export function WorkSettings({ onBack, onCleared }) {
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");

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
