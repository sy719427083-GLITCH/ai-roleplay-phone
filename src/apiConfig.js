export const STORAGE_KEY = "ccat-ai-api-configs";

const clamp = (value, min, max) => {
  const number = Number(value);
  if (Number.isNaN(number)) return min;
  return Math.min(max, Math.max(min, number));
};

export function createAiEndpoint() {
  return {
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
    model: "",
    customModel: "",
    modelMode: "manual",
    availableModels: [],
    temperature: 0.7,
    testStatus: "idle",
  };
}

export function createEmptyConfig() {
  const now = new Date().toISOString();
  return {
    id: "",
    name: "",
    main: createAiEndpoint(),
    secondary: {
      ...createAiEndpoint(),
      temperature: 0.4,
    },
    retryCount: 2,
    failoverEnabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeConfig(config) {
  const fallback = createEmptyConfig();
  const now = new Date().toISOString();

  return {
    ...fallback,
    ...config,
    id: config.id || `api-${Date.now()}`,
    name: (config.name || "未命名配置").trim(),
    main: normalizeEndpoint({ ...fallback.main, ...config.main }),
    secondary: normalizeEndpoint({ ...fallback.secondary, ...config.secondary }),
    retryCount: clamp(config.retryCount ?? fallback.retryCount, 0, 5),
    failoverEnabled: Boolean(config.failoverEnabled),
    createdAt: config.createdAt || now,
    updatedAt: now,
  };
}

export function normalizeEndpoint(endpoint) {
  return {
    ...endpoint,
    apiKey: endpoint.apiKey || "",
    baseUrl: (endpoint.baseUrl || "https://api.openai.com/v1").replace(/\/$/, ""),
    model: endpoint.model || "",
    customModel: endpoint.customModel || "",
    modelMode: endpoint.modelMode || "manual",
    availableModels: Array.isArray(endpoint.availableModels) ? endpoint.availableModels : [],
    temperature: clamp(endpoint.temperature ?? 0.7, 0, 2),
    testStatus: endpoint.testStatus || "idle",
  };
}

export function saveConfig(state, config) {
  const normalized = normalizeConfig(config);
  const configs = Array.isArray(state.configs) ? state.configs : [];
  const exists = configs.some((item) => item.id === normalized.id);
  const nextConfigs = exists
    ? configs.map((item) => (item.id === normalized.id ? normalized : item))
    : [...configs, normalized];

  return {
    configs: nextConfigs,
    selectedId: normalized.id,
  };
}

export function selectConfig(state, id) {
  const configs = Array.isArray(state.configs) ? state.configs : [];
  if (!configs.some((item) => item.id === id)) return state;
  return { ...state, selectedId: id };
}

export function updateAiConfig(config, target, patch) {
  const key = target === "secondary" ? "secondary" : "main";
  return normalizeConfig({
    ...config,
    [key]: normalizeEndpoint({
      ...config[key],
      ...patch,
    }),
  });
}

export function serializeConfigs(state) {
  return JSON.stringify({
    configs: (state.configs || []).map(normalizeConfig),
    selectedId: state.selectedId || "",
  });
}

export function parseConfigs(raw) {
  if (!raw) return { configs: [], selectedId: "" };

  try {
    const parsed = JSON.parse(raw);
    const configs = Array.isArray(parsed.configs) ? parsed.configs.map(normalizeConfig) : [];
    const selectedId = configs.some((item) => item.id === parsed.selectedId)
      ? parsed.selectedId
      : configs[0]?.id || "";
    return { configs, selectedId };
  } catch {
    return { configs: [], selectedId: "" };
  }
}

export async function fetchModels(endpoint) {
  const safeEndpoint = normalizeEndpoint(endpoint);
  if (!safeEndpoint.apiKey.trim()) {
    throw new Error("请先填写 API Key");
  }

  const response = await fetch(`${safeEndpoint.baseUrl}/models`, {
    headers: {
      Authorization: `Bearer ${safeEndpoint.apiKey.trim()}`,
    },
  });

  if (!response.ok) {
    throw new Error(`模型拉取失败：${response.status}`);
  }

  const data = await response.json();
  return (data.data || [])
    .map((model) => model.id)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}
