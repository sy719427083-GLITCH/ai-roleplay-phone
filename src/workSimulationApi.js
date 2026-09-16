import { parseConfigs, STORAGE_KEY } from './apiConfig.js';
import { buildWorkContext } from './workSimulation.js';
export async function requestWorkReply({ storage, world, character, career, text, signal }) {
  const config = parseConfigs(storage.getItem(STORAGE_KEY));
  const endpoint = config.mainConfigs.find(c => c.id === config.selectedMainId) || config.mainDraft;
  const model = endpoint?.model || endpoint?.customModel;
  if (!endpoint?.apiKey || !endpoint?.baseUrl || !model) throw new Error('请先在 CCAT OS 设置中保存主 API 和模型，再与人物对话。工作台仍可正常使用。');
  let base = endpoint.baseUrl.replace(/\/+$/, '');
  if (!base.endsWith('/v1')) base += '/v1';
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${endpoint.apiKey.trim()}` },
    body: JSON.stringify({ model, temperature: Number(endpoint.temperature ?? 0.7), messages: [
      { role: 'system', content: buildWorkContext(world, character, career) },
      ...(career.chats[character.id] || []).slice(-16).map(m => ({ role: m.from === 'me' ? 'user' : 'assistant', content: m.text })),
      { role: 'user', content: text },
    ] }),
  });
  if (!response.ok) throw new Error(`人物暂时未能回应（HTTP ${response.status}），你的输入已保留，可以重试。`);
  const data = await response.json();
  const reply = data?.choices?.[0]?.message?.content;
  if (typeof reply !== 'string' || !reply.trim()) throw new Error('模型没有返回对话内容，请重试。');
  return reply.trim();
}
