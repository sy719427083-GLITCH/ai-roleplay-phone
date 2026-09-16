import { SAVE_KEY, WAGES, transition } from './workSimulation.js';
import { addWalletIncomeOnce } from './walletStore.js';

export function initializePayroll(career, { id, now = Date.now(), durationMs = 300000 } = {}) {
  if (!career || career.payrollId) return career;
  return { ...career, payrollId: id, workDurationMs: [60000, 300000, 900000].includes(durationMs) ? durationMs : 300000,
    project: { ...career.project, wage: career.project.delivered ? 0 : WAGES[career.jobId],
      salaryPaid: career.project.delivered, startedAt: career.project.accepted && !career.project.delivered ? now : null } };
}
export function remainingWorkMs(career, now = Date.now()) {
  if (!career?.payrollId || career.project.delivered) return 0;
  if (!Number.isFinite(career.project.startedAt)) return career.workDurationMs;
  return Math.max(0, career.project.startedAt + career.workDurationMs - now);
}
export function formatCountdown(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
function save(storage, career) {
  try { storage.setItem(SAVE_KEY, JSON.stringify(career)); }
  catch { throw new Error('工作进度保存失败，请释放存储空间后重试结算。'); }
}
// Caller serializes settlement across tabs with the browser's Web Locks API.
// Save pending delivery first; wallet credits and durable receipt share one write.
export function completePaidWork(storage, career, now = Date.now()) {
  if (!career.payrollId || remainingWorkMs(career, now) > 0) throw new Error('工作倒计时尚未结束。');
  const pending = career.project.delivered ? career : transition(career, { type: 'deliver', now });
  if (!pending.project.delivered) throw new Error('请先完成资料整理和交付前检查。');
  if (pending.project.salaryPaid) return pending;
  save(storage, pending);
  addWalletIncomeOnce({ id: `salary:${pending.payrollId}:${pending.day}`, amount: pending.project.wage,
    desc: `工作工资 · ${pending.worldName} · 第${pending.day}天` }, storage);
  const paid = { ...pending, project: { ...pending.project, salaryPaid: true },
    log: [...pending.log, { day: pending.day, text: `工资 ¥${pending.project.wage} 已进入钱包。` }] };
  save(storage, paid);
  return paid;
}
