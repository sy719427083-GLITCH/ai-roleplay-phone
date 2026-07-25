import { normalizeWorkProject } from "./workProjectContract.js";

function selectedEndpoint(configs, selectedId, draft) {
  const saved = Array.isArray(configs) ? configs.find((item) => item.id === selectedId) : null;
  return saved || draft || null;
}

function isUsable(endpoint) {
  return endpoint && [endpoint.apiKey, endpoint.baseUrl, endpoint.model || endpoint.customModel]
    .every((value) => typeof value === "string" && value.trim());
}

export function selectWorkProjectEndpoints(apiState) {
  const candidates = [];
  const secondary = selectedEndpoint(apiState.secondaryConfigs, apiState.selectedSecondaryId, apiState.secondaryDraft);
  const main = selectedEndpoint(apiState.mainConfigs, apiState.selectedMainId, apiState.mainDraft);
  if (apiState.secondaryEnabled && isUsable(secondary)) candidates.push({ source: "secondary", endpoint: secondary });
  if (isUsable(main)) candidates.push({ source: "main", endpoint: main });
  return candidates;
}

export function parseWorkProjectResponse(content, revision) {
  if (typeof content !== "string") throw new Error("API 未返回合同内容");
  const trimmed = content.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const json = match ? match[1] : trimmed;
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("API 返回的合同格式不正确");
  }
  if (!Array.isArray(parsed.projects) || parsed.projects.length !== 5) {
    throw new Error("API 必须返回 5 份合同");
  }
  return parsed.projects.map((project, index) => {
    const normalized = normalizeWorkProject(project, `api-${revision + 1}-${index + 1}`);
    if (!normalized) throw new Error("API 返回的项目时间或金额无效");
    return normalized;
  });
}

function completionsUrl(baseUrl) {
  const base = baseUrl.trim().replace(/\/+$/, "");
  return `${base.endsWith("/v1") ? base : `${base}/v1`}/chat/completions`;
}

const SYSTEM_PROMPT = `你是 CCAT 工作中心的项目经理。生成五份彼此不同、可执行的中文自由职业项目合同。只返回 JSON，不要解释，不要 Markdown。严格使用结构：{"projects":[{"name":"项目名称","durationHours":72,"amountValue":2100,"description":"具体项目内容","difficulty":"简单|中等|困难"}]}。必须正好五项，durationHours 必须是正整数小时数，amountValue 必须是大于零的数字，其他字段不能为空，难度只能是简单、中等、困难。`;

async function requestProjects(candidate, revision, fetchImpl) {
  const { endpoint, source } = candidate;
  const response = await fetchImpl(completionsUrl(endpoint.baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${endpoint.apiKey.trim()}` },
    body: JSON.stringify({
      model: (endpoint.model || endpoint.customModel).trim(),
      temperature: Number.isFinite(Number(endpoint.temperature)) ? Number(endpoint.temperature) : 0.7,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: "请生成本轮五份新项目合同。" },
      ],
    }),
  });
  if (!response.ok) throw new Error(`请求失败（${response.status}）`);
  const data = await response.json();
  const projects = parseWorkProjectResponse(data?.choices?.[0]?.message?.content, revision);
  return { projects, source };
}

export async function generateWorkProjects({ apiState, revision, fetchImpl = fetch }) {
  const candidates = selectWorkProjectEndpoints(apiState);
  if (!candidates.length) throw new Error("请先在 API 设置中配置主 API 或副 API");
  let lastError;
  for (const candidate of candidates) {
    try {
      return await requestProjects(candidate, revision, fetchImpl);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(lastError?.message || "合同生成失败，请稍后重试");
}
