import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BookMarked,
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Database,
  Eye,
  Gamepad2,
  Globe2,
  Heart,
  Image,
  Infinity,
  KeyRound,
  ListPlus,
  Mail,
  MapPin,
  Palette,
  Settings,
  ShoppingBag,
  Smartphone,
  Soup,
  UserRound,
  UsersRound,
  Volume2,
  WalletCards,
} from "lucide-react";
import {
  createEmptyConfig,
  fetchModels,
  normalizeEndpointConfig,
  parseConfigs,
  serializeConfigs,
  STORAGE_KEY,
} from "./apiConfig.js";

const appGroups = [
  [
    { title: "消息", icon: Mail, variant: "line" },
    { title: "论坛", icon: UsersRound, variant: "line" },
    { title: "小红书", icon: BookMarked, variant: "cutout" },
    { title: "钱包", icon: WalletCards, variant: "line" },
    { title: "游戏", icon: Gamepad2, variant: "line" },
    { title: "美化", icon: Palette, variant: "cutout" },
    { title: "世界观", icon: Globe2, variant: "line" },
    { title: "预设", icon: ListPlus, variant: "line" },
    { title: "外卖", icon: Soup, variant: "line" },
    { title: "外出", icon: MapPin, variant: "line" },
    { title: "日记", icon: BookMarked, variant: "cutout" },
    { title: "经营", icon: Briefcase, variant: "line" },
  ],
  [
    { title: "微博", icon: Eye, variant: "line" },
    { title: "平行世界", icon: Infinity, variant: "line" },
    { title: "购物", icon: ShoppingBag, variant: "line" },
    { title: "工作", icon: Briefcase, variant: "line" },
    { title: "情侣空间", icon: Heart, variant: "solid" },
    { title: "查手机", icon: Smartphone, variant: "line" },
    { title: "日程", icon: CalendarDays, variant: "line" },
  ],
];

const tabs = [
  { id: "home", label: "主页" },
  { id: "characters", label: "角色" },
  { id: "me", label: "我" },
  { id: "settings", label: "设置" },
];

const settingsItems = [
  { id: "api", label: "API设置", icon: KeyRound, featured: true },
  { id: "sound", label: "声音设置", icon: Volume2 },
  { id: "image", label: "画面生图", icon: Image },
  { id: "appearance", label: "外观设置", icon: Palette },
  { id: "time", label: "时间设置", icon: Clock3 },
  { id: "notice", label: "通知开关", icon: Bell },
  { id: "data", label: "数据管理", icon: Database },
  { id: "system", label: "系统设置", icon: Settings },
];

const formatDate = (date) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);

const formatTime = (date) =>
  new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

function LockScreen({ onUnlock }) {
  const [now, setNow] = useState(new Date());
  const [startY, setStartY] = useState(null);
  const [pull, setPull] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000 * 20);
    return () => window.clearInterval(timer);
  }, []);

  const begin = (event) => setStartY(event.clientY ?? event.touches?.[0]?.clientY ?? 0);
  const move = (event) => {
    if (startY === null) return;
    const current = event.clientY ?? event.touches?.[0]?.clientY ?? startY;
    setPull(Math.min(120, Math.max(0, startY - current)));
  };
  const end = () => {
    if (pull > 68) onUnlock();
    setStartY(null);
    setPull(0);
  };

  return (
    <section
      className="lock-screen"
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      style={{ "--lift": `${pull * -0.35}px` }}
    >
      <div className="lock-time" style={{ transform: `translateY(var(--lift))` }}>
        <p>{formatDate(now)}</p>
        <h1>{formatTime(now)}</h1>
      </div>
      <button className="unlock-handle" onClick={onUnlock} aria-label="上划解锁">
        <span></span>
        <em>tap or swipe to unlock</em>
      </button>
    </section>
  );
}

function AppIcon({ item, onOpen }) {
  const Icon = item.icon;
  const isSolid = item.variant === "solid";
  const isCutout = item.variant === "cutout";
  const open = (event) => {
    const rect = event.currentTarget.querySelector(".app-icon").getBoundingClientRect();
    onOpen({
      title: item.title,
      originX: rect.left + rect.width / 2,
      originY: rect.top + rect.height / 2,
    });
  };

  return (
    <button className="app-icon-button" onClick={open}>
      <span className="app-icon">
        <Icon
          size={28}
          strokeWidth={isCutout ? 0.9 : isSolid ? 1.05 : 1.45}
          stroke={isCutout ? "#ffffff" : "currentColor"}
          fill={isSolid || isCutout ? "currentColor" : "none"}
          fillOpacity={isSolid || isCutout ? 0.9 : 0}
        />
      </span>
      <span>{item.title}</span>
    </button>
  );
}

function HomeScreen({ onOpen }) {
  const [page, setPage] = useState(0);
  const [startX, setStartX] = useState(null);
  const [dragX, setDragX] = useState(0);
  const didDragRef = useRef(false);

  const begin = (event) => {
    didDragRef.current = false;
    setStartX(event.clientX ?? event.touches?.[0]?.clientX ?? 0);
  };
  const move = (event) => {
    if (startX === null) return;
    const current = event.clientX ?? event.touches?.[0]?.clientX ?? startX;
    const rawDelta = current - startX;
    if (Math.abs(rawDelta) > 8) didDragRef.current = true;
    const atFirstPage = page === 0 && rawDelta > 0;
    const atLastPage = page === appGroups.length - 1 && rawDelta < 0;
    const resistedDelta = atFirstPage || atLastPage ? rawDelta * 0.28 : rawDelta;
    setDragX(Math.max(-window.innerWidth, Math.min(window.innerWidth, resistedDelta)));
  };
  const end = () => {
    const threshold = Math.min(92, window.innerWidth * 0.22);
    if (dragX < -threshold && page < appGroups.length - 1) setPage(page + 1);
    if (dragX > threshold && page > 0) setPage(page - 1);
    setStartX(null);
    setDragX(0);
    window.setTimeout(() => {
      didDragRef.current = false;
    }, 160);
  };
  const isDragging = startX !== null;
  const openApp = (app) => {
    if (didDragRef.current) return;
    onOpen(app);
  };

  return (
    <section
      className="screen-view home-view"
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="top-line">
        <span>CCAT OS</span>
      </div>
      <div className="app-carousel">
        <div
          className="app-pages"
          style={{
            transform: `translate3d(calc(${-page * 100}% + ${dragX}px), 0, 0)`,
            transition: isDragging ? "none" : undefined,
          }}
        >
          {appGroups.map((group, index) => (
            <div className="app-grid" key={index}>
              {group.map((item) => (
                <AppIcon item={item} key={item.title} onOpen={openApp} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="pager">
        {appGroups.map((_, index) => (
          <button
            className={index === page ? "active" : ""}
            key={index}
            onClick={() => setPage(index)}
            aria-label={`第 ${index + 1} 页`}
          />
        ))}
      </div>
    </section>
  );
}

function QuietPanel({ title, icon: Icon }) {
  return (
    <section className="screen-view centered-view">
      <div className="large-glass-icon">
        <Icon size={32} strokeWidth={1.5} />
      </div>
      <h2>{title}</h2>
    </section>
  );
}

function SettingsScreen({ onOpen }) {
  return (
    <section className="screen-view settings-view">
      <div className="section-title">
        <span>设置</span>
        <em>Settings</em>
      </div>
      <div className="settings-list">
        {settingsItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={`setting-row ${item.featured ? "featured" : ""}`}
              key={item.id}
              onClick={() => onOpen(item)}
            >
              <span className="setting-icon">
                <Icon size={20} strokeWidth={1.7} />
              </span>
              <span>{item.label}</span>
              <ChevronRight size={17} />
            </button>
          );
        })}
      </div>
      <p className="version-label">Ccat OS v0.1.23</p>
    </section>
  );
}

function TabSvgIcon({ id }) {
  return (
    <svg className="tab-svg" viewBox="0 0 24 24" aria-hidden="true">
      {id === "home" && (
        <>
          <path d="M3.6 11.1 12 4.1l8.4 7h-2v8.4h-4.2v-5.4H9.8v5.4H5.6v-8.4h-2Z" />
          <path className="tab-knockout" d="M10.4 19.5v-4.8h3.2v4.8" />
        </>
      )}
      {id === "characters" && (
        <>
          <circle cx="12" cy="7" r="3.4" />
          <path d="M6.1 18.8c.5-4.2 2.7-6.1 5.9-6.1s5.4 1.9 5.9 6.1H6.1Z" />
          <path className="tab-soft-base" d="M5.5 20h13" />
        </>
      )}
      {id === "me" && (
        <>
          <circle cx="12" cy="12" r="8.1" />
          <circle className="tab-avatar-cutout" cx="12" cy="8.8" r="2.4" />
          <path className="tab-avatar-cutout" d="M7.6 17.2c.8-2.5 2.3-3.6 4.4-3.6s3.6 1.1 4.4 3.6H7.6Z" />
        </>
      )}
      {id === "settings" && (
        <g>
          <path d="M10.2 3.3h3.6l.5 2.1c.5.2.9.4 1.3.7l2-.7 1.8 3.1-1.6 1.4c0 .3.1.7.1 1s0 .7-.1 1l1.6 1.4-1.8 3.1-2-.7c-.4.3-.9.5-1.3.7l-.5 2.1h-3.6l-.5-2.1c-.5-.2-.9-.4-1.3-.7l-2 .7-1.8-3.1 1.6-1.4c0-.3-.1-.7-.1-1s0-.7.1-1L4.6 8.5l1.8-3.1 2 .7c.4-.3.9-.5 1.3-.7l.5-2.1Z" />
          <circle className="tab-gear-cutout" cx="12" cy="11" r="2.7" />
        </g>
      )}
    </svg>
  );
}

function BottomTabs({ active, onChange }) {
  return (
    <nav className="bottom-tabs">
      {tabs.map((tab) => {
        const selected = active === tab.id;
        return (
          <button className={selected ? "active" : ""} key={tab.id} onClick={() => onChange(tab.id)}>
            <span className="tab-icon-wrap">
              <TabSvgIcon id={tab.id} />
            </span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ApiEndpoint({
  title,
  badge,
  value,
  onChange,
  onFetchModels,
  onSave,
  onTest,
  onDelete,
  saveLabel,
  namePlaceholder,
  headerAction,
}) {
  const options = value.availableModels.length ? value.availableModels : ["gpt-4.1", "gpt-4.1-mini", "gpt-4o-mini"];
  return (
    <div className="api-block api-engine-card">
      <div className="api-block-title">
        <span>
          {title}
          <em>{badge}</em>
        </span>
        {headerAction}
      </div>
      <label>
        <span>配置名称（必填）</span>
        <input value={value.name} onChange={(event) => onChange({ name: event.target.value })} placeholder={namePlaceholder} />
      </label>
      <label>
        <span>接口地址 (BASE URL)</span>
        <input value={value.baseUrl} onChange={(event) => onChange({ baseUrl: event.target.value })} placeholder="https://api.openai.com" />
      </label>
      <label>
        <span>访问凭证 (API KEY)</span>
        <input
          type="password"
          value={value.apiKey}
          onChange={(event) => onChange({ apiKey: event.target.value })}
          placeholder="sk-..."
        />
      </label>
      <label>
        <span>模型标识 (MODEL)</span>
        <input
          list={`${title}-models`}
          value={value.modelMode === "custom" ? value.customModel : value.model}
          onChange={(event) => onChange({ customModel: event.target.value, model: event.target.value, modelMode: "custom" })}
          placeholder="下拉选择或手动输入"
        />
        <datalist id={`${title}-models`}>
          {options.map((model) => (
            <option value={model} key={model} />
          ))}
        </datalist>
      </label>
      {value.availableModels.length > 0 && (
        <label>
          <span>已获取模型</span>
          <select
            className="model-choice-select"
            value={value.model}
            onChange={(event) => onChange({ model: event.target.value, customModel: "", modelMode: "manual" })}
          >
            {value.availableModels.map((model) => (
              <option value={model} key={model}>
                {model}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="api-model-actions">
        <button className="soft-api-button" onClick={onFetchModels}>获取模型</button>
        <button className="soft-api-button" onClick={onTest}>测试连接</button>
      </div>
      <label className="range-label api-temperature">
        <span>创造力 (TEMPERATURE)</span>
        <strong>{Number(value.temperature).toFixed(1)}</strong>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={value.temperature}
          onChange={(event) => onChange({ temperature: event.target.value })}
        />
      </label>
      <p className={`status-text ${value.testStatus}`}>{statusCopy(value.testStatus)}</p>
      <div className="api-actions">
        <button className="danger-api-button" onClick={onDelete}>删除</button>
        <button className="save-api-button" onClick={onSave}>{saveLabel}</button>
      </div>
    </div>
  );
}

function statusCopy(status) {
  if (status === "testing") return "测试中";
  if (status === "ok") return "连接可用";
  if (status === "error") return "需要检查配置";
  if (status === "models") return "模型已更新";
  return "等待配置";
}

function ApiNotice({ notice, onClose }) {
  if (!notice) return null;
  return (
    <div className="api-notice-backdrop" role="dialog" aria-modal="true">
      <div className={`api-notice ${notice.tone}`}>
        <strong>{notice.title}</strong>
        <p>{notice.message}</p>
        <button onClick={onClose}>确定</button>
      </div>
    </div>
  );
}

function ApiSettingsPage({ onBack }) {
  const [saved, setSaved] = useState(() => parseConfigs(window.localStorage.getItem(STORAGE_KEY)));
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, serializeConfigs(saved));
  }, [saved]);

  const patchEndpoint = (key, patch) => {
    const draftKey = key === "secondary" ? "secondaryDraft" : "mainDraft";
    setSaved((current) => ({
      ...current,
      [draftKey]: {
        ...current[draftKey],
        ...patch,
      },
    }));
  };

  const saveEndpoint = (key) => {
    const draftKey = key === "secondary" ? "secondaryDraft" : "mainDraft";
    const configsKey = key === "secondary" ? "secondaryConfigs" : "mainConfigs";
    const selectedKey = key === "secondary" ? "selectedSecondaryId" : "selectedMainId";

    setSaved((current) => {
      const normalized = normalizeEndpointConfig(current[draftKey]);
      const configs = Array.isArray(current[configsKey]) ? current[configsKey] : [];
      const exists = configs.some((item) => item.id === normalized.id);
      const nextConfigs = exists
        ? configs.map((item) => (item.id === normalized.id ? normalized : item))
        : [...configs, normalized];
      return {
        ...current,
        [configsKey]: nextConfigs,
        [selectedKey]: normalized.id,
        [draftKey]: normalized,
      };
    });
    setNotice({
      tone: "ok",
      title: "保存成功",
      message: key === "secondary" ? "副API配置已保存并设为当前使用。" : "主API配置已保存并设为当前使用。",
    });
  };

  const deleteEndpoint = (key) => {
    const configsKey = key === "secondary" ? "secondaryConfigs" : "mainConfigs";
    const selectedKey = key === "secondary" ? "selectedSecondaryId" : "selectedMainId";
    const draftKey = key === "secondary" ? "secondaryDraft" : "mainDraft";
    setSaved((current) => {
      const selectedId = current[selectedKey] || current[draftKey]?.id;
      const configs = Array.isArray(current[configsKey]) ? current[configsKey] : [];
      const nextConfigs = configs.filter((item) => item.id !== selectedId);
      const nextSelected = nextConfigs[0]?.id || "";
      return {
        ...current,
        [configsKey]: nextConfigs,
        [selectedKey]: nextSelected,
        [draftKey]: nextSelected
          ? nextConfigs[0]
          : normalizeEndpointConfig({
              ...createEmptyConfig()[key === "secondary" ? "secondary" : "main"],
              name: key === "secondary" ? "副API配置" : "主API配置",
            }),
      };
    });
  };

  const selectEndpoint = (key, id) => {
    const configsKey = key === "secondary" ? "secondaryConfigs" : "mainConfigs";
    const selectedKey = key === "secondary" ? "selectedSecondaryId" : "selectedMainId";
    const draftKey = key === "secondary" ? "secondaryDraft" : "mainDraft";
    setSaved((current) => {
      if (!id) {
        return {
          ...current,
          [selectedKey]: "",
          [draftKey]: normalizeEndpointConfig({
            ...createEmptyConfig()[key === "secondary" ? "secondary" : "main"],
            name: key === "secondary" ? "副API配置" : "主API配置",
          }),
        };
      }
      const config = current[configsKey].find((item) => item.id === id);
      if (!config) return current;
      return { ...current, [selectedKey]: id, [draftKey]: config };
    });
  };

  const loadModels = async (key) => {
    patchEndpoint(key, { testStatus: "testing" });
    try {
      const endpoint = key === "secondary" ? saved.secondaryDraft : saved.mainDraft;
      const models = await fetchModels(endpoint);
      patchEndpoint(key, { availableModels: models, model: models[0] || endpoint.model || "", customModel: "", modelMode: "manual", testStatus: "models" });
    } catch {
      patchEndpoint(key, { testStatus: "error" });
    }
  };

  const testEndpoint = async (key) => {
    patchEndpoint(key, { testStatus: "testing" });
    try {
      const endpoint = key === "secondary" ? saved.secondaryDraft : saved.mainDraft;
      const models = await fetchModels(endpoint);
      patchEndpoint(key, { availableModels: models, testStatus: "ok" });
      setNotice({
        tone: "ok",
        title: "连接成功",
        message: `已连接，检测到 ${models.length || 0} 个模型。`,
      });
    } catch {
      patchEndpoint(key, { testStatus: "error" });
      setNotice({
        tone: "error",
        title: "连接失败",
        message: "请检查 API Key、接口地址和网络状态。",
      });
    }
  };

  return (
    <section className="full-page api-page">
      <header className="page-header">
        <button className="api-back-button" onClick={onBack} aria-label="返回">
          <ChevronLeft size={20} />
          <span>返回</span>
        </button>
        <span>高级 API 配置</span>
        <span></span>
      </header>
      <div className="api-scroll">
        <div className="glass-form api-status-card">
          <div className="api-card-heading">
            <span>当前应用状态</span>
            <em>ACTIVE</em>
          </div>
          {saved.mainConfigs.length > 0 && (
            <label className="api-select-bar">
              <span>主API设置</span>
              <select
                value={saved.selectedMainId}
                onChange={(event) => selectEndpoint("main", event.target.value)}
              >
                {saved.mainConfigs.map((config) => (
                  <option value={config.id} key={config.id}>
                    {config.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {saved.secondaryEnabled && (
            <label className="api-select-bar">
              <span>副API设置</span>
              <select
                value={saved.selectedSecondaryId}
                onChange={(event) => selectEndpoint("secondary", event.target.value)}
              >
                <option value=""></option>
                {saved.secondaryConfigs.map((config) => (
                  <option value={config.id} key={config.id}>
                    {config.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <ApiEndpoint
          title="主引擎 (Main API)"
          badge="CORE"
          value={saved.mainDraft}
          onChange={(patch) => patchEndpoint("main", patch)}
          onFetchModels={() => loadModels("main")}
          onSave={() => saveEndpoint("main")}
          onTest={() => testEndpoint("main")}
          onDelete={() => deleteEndpoint("main")}
          saveLabel="保存主配置"
          namePlaceholder="例如： OpenAI GPT-4"
        />

        {!saved.secondaryEnabled && (
          <div className="glass-form api-enable-secondary">
            <button
              className="switch-row"
              onClick={() => setSaved((current) => ({ ...current, secondaryEnabled: !current.secondaryEnabled }))}
            >
              <span>启用副API</span>
              <i></i>
            </button>
          </div>
        )}

        {saved.secondaryEnabled && (
          <ApiEndpoint
            title="副引擎 (Sub API)"
            badge="BACKUP"
            value={saved.secondaryDraft}
            onChange={(patch) => patchEndpoint("secondary", patch)}
            onFetchModels={() => loadModels("secondary")}
            onSave={() => saveEndpoint("secondary")}
            onTest={() => testEndpoint("secondary")}
            onDelete={() => deleteEndpoint("secondary")}
            saveLabel="保存副配置"
            namePlaceholder="例如： Claude 3 Haiku"
            headerAction={(
              <button
                className="switch-row mini-switch on"
                onClick={() => setSaved((current) => ({ ...current, secondaryEnabled: !current.secondaryEnabled }))}
                aria-label="关闭副API"
              >
                <i></i>
              </button>
            )}
          />
        )}

        {saved.secondaryEnabled && (
          <div className="glass-form api-fallback-card">
            <div className="api-card-heading">
              <span>容错策略 (Fallback)</span>
            </div>
            <label>
              <span>失败重试次数</span>
              <select value={saved.retryCount} onChange={(event) => setSaved((current) => ({ ...current, retryCount: Number(event.target.value) }))}>
                {[0, 1, 2, 3, 4, 5].map((count) => (
                  <option value={count} key={count}>
                    {count === 0 ? "不重试（0）" : `${count} 次`}
                  </option>
                ))}
              </select>
            </label>
            <button
              className={`switch-row ${saved.failoverEnabled ? "on" : ""}`}
              onClick={() => setSaved((current) => ({ ...current, failoverEnabled: !current.failoverEnabled }))}
            >
              <span>主引擎失败时切换副引擎</span>
              <i></i>
            </button>
            <p className="helper-text">副AI一般用于总结记忆等任务。</p>
          </div>
        )}
      </div>
      <ApiNotice notice={notice} onClose={() => setNotice(null)} />
    </section>
  );
}

function GenericSettingPage({ item, onBack }) {
  const Icon = item.icon;
  return (
    <section className="full-page quiet-page">
      <header className="page-header">
        <button onClick={onBack} aria-label="返回">
          <ChevronLeft size={20} />
        </button>
        <span>{item.label}</span>
        <span></span>
      </header>
      <div className="quiet-center">
        <div className="large-glass-icon">
          <Icon size={34} strokeWidth={1.5} />
        </div>
      </div>
    </section>
  );
}

function OpenedApp({ app, onClose }) {
  const isWallet = app.title === "钱包";
  const [walletData, setWalletData] = useState(() => {
    try {
      const stored = window.localStorage.getItem("roleplayWallet");
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          balance: Number(parsed.balance) || 0,
          transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        };
      }
    } catch {
      return { balance: 0, transactions: [] };
    }
    return { balance: 0, transactions: [] };
  });
  const [walletAmount, setWalletAmount] = useState("");
  const [walletDesc, setWalletDesc] = useState("");
  const [walletMode, setWalletMode] = useState(null);
  const formatMoney = (amount) =>
    Number(amount || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  useEffect(() => {
    if (!isWallet) return;
    window.localStorage.setItem("roleplayWallet", JSON.stringify(walletData));
  }, [isWallet, walletData]);

  const currentMonth = new Date().getMonth() + 1;
  const monthTransactions = walletData.transactions.filter((bill) => Number(String(bill.date || "").split("-")[0]) === currentMonth);
  const walletIncome = monthTransactions.filter((bill) => bill.type === "add").reduce((sum, bill) => sum + bill.amount, 0);
  const walletExpense = monthTransactions.filter((bill) => bill.type === "sub").reduce((sum, bill) => sum + bill.amount, 0);

  const openWalletModal = (type) => {
    setWalletMode(type);
    setWalletAmount("");
    setWalletDesc("");
  };

  const changeWallet = () => {
    if (!walletMode) return;
    const amount = Number(walletAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const now = new Date();
    const date = `${now.getMonth() + 1}-${now.getDate()} ${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes(),
    ).padStart(2, "0")}`;
    setWalletData((current) => ({
      balance: current.balance + (walletMode === "add" ? amount : -amount),
      transactions: [
        {
          id: Date.now(),
          type: walletMode,
          amount,
          desc: walletDesc.trim(),
          date,
        },
        ...current.transactions,
      ],
    }));
    setWalletAmount("");
    setWalletDesc("");
    setWalletMode(null);
  };

  const clearWalletHistory = () => {
    setWalletData((current) => ({ ...current, transactions: [] }));
  };

  return (
    <section
      className={`full-page app-page ${isWallet ? "wallet-page" : ""}`}
    >
      <header className="page-header">
        <button onClick={onClose} aria-label="返回">
          <ChevronLeft size={20} />
        </button>
        <span>{app.title}</span>
        <span></span>
      </header>
      {isWallet ? (
        <div className="wallet-content">
          <section className="bank-card">
            <div className="card-type">BLACK PLATINUM</div>
            <div className="card-chip"></div>
            <div className="card-balance-label">Total Balance</div>
            <div className="card-balance">
              <span className="currency">¥</span>
              <span>{formatMoney(walletData.balance)}</span>
            </div>
            <div className="card-footer">
              <span>**** **** **** 8888</span>
              <span>VALID 12/28</span>
            </div>
            <div className="card-actions">
              <button className="mini-action-btn" onClick={() => openWalletModal("add")} aria-label="入账">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                </svg>
              </button>
              <button className="mini-action-btn" onClick={() => openWalletModal("sub")} aria-label="支出">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19 13H5v-2h14v2z" />
                </svg>
              </button>
            </div>
          </section>

          <section className="wallet-analytics">
            <div className="ana-box">
              <div className="ana-label">本月收入</div>
              <div className="ana-val">¥{formatMoney(walletIncome)}</div>
            </div>
            <div className="ana-divider"></div>
            <div className="ana-box">
              <div className="ana-label">本月支出</div>
              <div className="ana-val">¥{formatMoney(walletExpense)}</div>
            </div>
          </section>

          <section className="wallet-apps" aria-label="钱包服务">
            {[
              {
                label: "扫一扫",
                path: "M4 4h6v6H4zm16 0h-6v6h6zM4 14h6v6H4zm14 0h2v2h-2zm-2 2h2v2h-2zm2 2h2v2h-2zM14 14h2v2h-2zm0 4h2v2h-2zM6 6h2v2H6zm10 0h2v2h-2zM6 16h2v2H6z",
              },
              { label: "付款码", path: "M3 4h4v16H3zm6 0h2v16H9zm4 0h4v16h-4zm6 0h2v16h-2z" },
              { label: "理财", path: "M16 6l2.3 2.3-4.9 4.9-4-4L2 16.6 3.4 18l6-6 4 4 6.3-6.3L22 12V6z" },
              {
                label: "卡包",
                path: "M21 18v1c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z",
              },
            ].map((item) => (
              <button className="w-app" key={item.label}>
                <span className="w-app-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d={item.path} />
                  </svg>
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </section>

          <section className="tx-section">
            <div className="tx-section-title">
              <span>近期账单</span>
              <button onClick={clearWalletHistory}>清空</button>
            </div>
            <div className="tx-list">
              {walletData.transactions.length === 0 ? (
                <div className="empty-tx">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                  </svg>
                  <p>本月暂无账单流水</p>
                </div>
              ) : (
                walletData.transactions.map((bill, index) => {
                  const isAdd = bill.type === "add";
                  return (
                    <div className="tx-item" key={bill.id} style={{ animationDelay: `${index * 0.06}s` }}>
                      <div className="tx-left">
                        <div className={`tx-icon ${isAdd ? "add" : "sub"}`}>
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            {isAdd ? (
                              <>
                                <path d="M12 4v10" />
                                <path d="m7.8 10.2 4.2 4.2 4.2-4.2" />
                                <path d="M5.5 18.8h13" />
                              </>
                            ) : (
                              <>
                                <path d="M12 20V10" />
                                <path d="m7.8 13.8 4.2-4.2 4.2 4.2" />
                                <path d="M5.5 5.2h13" />
                              </>
                            )}
                          </svg>
                        </div>
                        <div className="tx-info">
                          <span className="tx-title">{bill.desc || (isAdd ? "入账" : "支出")}</span>
                          <span className="tx-date">{bill.date}</span>
                        </div>
                      </div>
                      <div className={`tx-amount ${isAdd ? "add" : "sub"}`}>
                        {isAdd ? "+" : "-"}{formatMoney(bill.amount)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
          {walletMode && (
            <div className="wallet-modal-backdrop">
              <div className="wallet-modal">
                <strong>{walletMode === "add" ? "入账金额" : "支出金额"}</strong>
                <input
                  autoFocus
                  inputMode="decimal"
                  value={walletAmount}
                  onChange={(event) => setWalletAmount(event.target.value)}
                  placeholder="输入金额 (¥)"
                />
                <input
                  value={walletDesc}
                  onChange={(event) => setWalletDesc(event.target.value)}
                  placeholder="输入备注 (如：工资、购物)"
                />
                <div className="wallet-modal-actions">
                  <button onClick={() => setWalletMode(null)}>取消</button>
                  <button onClick={changeWallet}>确定</button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="quiet-center">
          <div className="soft-line"></div>
        </div>
      )}
    </section>
  );
}

function LaunchLoader() {
  return (
    <section className="launch-loader" aria-label="正在进入">
      <div className="launch-loader-track">
        <span></span>
      </div>
    </section>
  );
}

export function App() {
  const [locked, setLocked] = useState(true);
  const [tab, setTab] = useState("home");
  const [openedApp, setOpenedApp] = useState(null);
  const [settingPage, setSettingPage] = useState(null);
  const [launching, setLaunching] = useState(null);
  const [hasShownLaunch, setHasShownLaunch] = useState(false);

  useEffect(() => {
    if (!launching) return undefined;
    const timer = window.setTimeout(() => {
      if (launching.type === "app") setOpenedApp(launching.payload);
      if (launching.type === "setting") setSettingPage(launching.payload);
      setLaunching(null);
    }, 920);
    return () => window.clearTimeout(timer);
  }, [launching]);

  const openWithLoader = (type, payload) => {
    if (hasShownLaunch) {
      if (type === "app") setOpenedApp(payload);
      if (type === "setting") setSettingPage(payload);
      return;
    }
    setHasShownLaunch(true);
    setLaunching({ type, payload });
  };

  const content = useMemo(() => {
    if (tab === "home") return <HomeScreen onOpen={(app) => openWithLoader("app", app)} />;
    if (tab === "characters") return <QuietPanel title="角色" icon={CircleUserRound} />;
    if (tab === "me") return <QuietPanel title="我" icon={UserRound} />;
    return <SettingsScreen onOpen={(item) => openWithLoader("setting", item)} />;
  }, [tab, hasShownLaunch]);

  if (locked) return <LockScreen onUnlock={() => setLocked(false)} />;

  const hasOverlay = Boolean(openedApp || settingPage || launching);

  return (
    <main className={`phone-surface ${hasOverlay ? "overlay-active" : ""}`}>
      <div className="phone-stage">
        {content}
        <BottomTabs active={tab} onChange={setTab} />
      </div>
      {openedApp && <OpenedApp app={openedApp} onClose={() => setOpenedApp(null)} />}
      {settingPage?.id === "api" && <ApiSettingsPage onBack={() => setSettingPage(null)} />}
      {settingPage && settingPage.id !== "api" && <GenericSettingPage item={settingPage} onBack={() => setSettingPage(null)} />}
      {launching && <LaunchLoader />}
    </main>
  );
}
