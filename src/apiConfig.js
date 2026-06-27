export const STORAGE_KEY = "ccat-ai-api-configs";

const clamp = (value, min, max) => {
  const number = Number(value);
  if (Number.isNaN(number)) return min;
  return Math.min(max, Math.max(min, number));
};

export function createAiEndpoint() {
  return {
    id: "",
    name: "",
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

export function createApiStateFromConfig(config = createEmptyConfig()) {
  const normalized = normalizeConfig(config);
  const main = normalizeEndpointConfig({ ...normalized.main, name: normalized.name || "主API配置" });
  const secondary = normalizeEndpointConfig({ ...normalized.secondary, name: `${normalized.name || "副API配置"} 副API` });
  return {
    mainConfigs: main.apiKey || main.model || main.customModel ? [main] : [],
    selectedMainId: main.apiKey || main.model || main.customModel ? main.id : "",
    secondaryConfigs: secondary.apiKey || secondary.model || secondary.customModel ? [secondary] : [],
    selectedSecondaryId: "",
    mainDraft: main,
    secondaryDraft: secondary,
    secondaryEnabled: false,
    retryCount: normalized.retryCount,
    failoverEnabled: normalized.failoverEnabled,
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
    id: endpoint.id || "",
    name: endpoint.name || "",
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

export function normalizeEndpointConfig(endpoint) {
  const now = new Date().toISOString();
  const normalized = normalizeEndpoint(endpoint || createAiEndpoint());
  return {
    ...normalized,
    id: normalized.id || `endpoint-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: (normalized.name || "未命名API").trim(),
    createdAt: endpoint?.createdAt || now,
    updatedAt: now,
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
  if ("mainConfigs" in state || "secondaryConfigs" in state) {
    return JSON.stringify({
      mainConfigs: (state.mainConfigs || []).map(normalizeEndpointConfig),
      selectedMainId: state.selectedMainId || "",
      secondaryConfigs: (state.secondaryConfigs || []).map(normalizeEndpointConfig),
      selectedSecondaryId: state.selectedSecondaryId || "",
      mainDraft: normalizeEndpointConfig(state.mainDraft || createAiEndpoint()),
      secondaryDraft: normalizeEndpointConfig(state.secondaryDraft || createAiEndpoint()),
      secondaryEnabled: Boolean(state.secondaryEnabled),
      retryCount: clamp(state.retryCount ?? 2, 0, 5),
      failoverEnabled: Boolean(state.failoverEnabled),
    });
  }

  return JSON.stringify({
    configs: (state.configs || []).map(normalizeConfig),
    selectedId: state.selectedId || "",
  });
}

export function parseConfigs(raw) {
  if (!raw) return createApiStateFromConfig();

  try {
    const parsed = JSON.parse(raw);
    if ("mainConfigs" in parsed || "secondaryConfigs" in parsed) {
      const mainConfigs = Array.isArray(parsed.mainConfigs) ? parsed.mainConfigs.map(normalizeEndpointConfig) : [];
      const secondaryConfigs = Array.isArray(parsed.secondaryConfigs) ? parsed.secondaryConfigs.map(normalizeEndpointConfig) : [];
      const selectedMainId = mainConfigs.some((item) => item.id === parsed.selectedMainId)
        ? parsed.selectedMainId
        : mainConfigs[0]?.id || "";
      const selectedSecondaryId = secondaryConfigs.some((item) => item.id === parsed.selectedSecondaryId)
        ? parsed.selectedSecondaryId
        : secondaryConfigs[0]?.id || "";

      return {
        mainConfigs,
        selectedMainId,
        secondaryConfigs,
        selectedSecondaryId,
        mainDraft: normalizeEndpointConfig(parsed.mainDraft || mainConfigs.find((item) => item.id === selectedMainId) || createAiEndpoint()),
        secondaryDraft: normalizeEndpointConfig(parsed.secondaryDraft || secondaryConfigs.find((item) => item.id === selectedSecondaryId) || createAiEndpoint()),
        secondaryEnabled: Boolean(parsed.secondaryEnabled),
        retryCount: clamp(parsed.retryCount ?? 2, 0, 5),
        failoverEnabled: Boolean(parsed.failoverEnabled),
      };
    }

    const configs = Array.isArray(parsed.configs) ? parsed.configs.map(normalizeConfig) : [];
    const selectedId = configs.some((item) => item.id === parsed.selectedId)
      ? parsed.selectedId
      : configs[0]?.id || "";
    return createApiStateFromConfig(configs.find((item) => item.id === selectedId) || configs[0] || createEmptyConfig());
  } catch {
    return createApiStateFromConfig();
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
