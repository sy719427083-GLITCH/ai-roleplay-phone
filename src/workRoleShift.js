export const WORK_APPROACHES = [
  { id: 'together', label: '一起商量着做', effect: '留下共同解决问题的经历', detail: '一起核实问题，给我一个具体建议，我们共同决定如何推进。' },
  { id: 'delegate', label: '请你帮我分担', effect: '协助成功后最多缩短 20% 工作时间', detail: '一起分工，请明确你负责哪部分、我负责哪部分，帮助我更快完成。' },
  { id: 'careful', label: '先准备备选方案', effect: '把备选安排留给收工时复盘', detail: '采用稳妥的方式，提出一个风险和对应的备选安排。' },
];
export function makeRoleWorkPrompt(phase, career, person, choice) {
  const shared = (career.project.scenes || []).filter(s => s.personId === person.id).map(s => `${s.phase}：${s.reply}`).join('\n');
  const base = `【工作现场，不是让用户写文件】今天一起处理「${career.project.title}」。突发情况：${career.project.event}。你是${person.name}，保持你原本的身份和性格，不要自动扮演上司。与用户已发生的工作互动：${shared || '刚开始合作'}。`;
  if (phase === 'intro') return `${base}\n请主动和我打招呼，用你的说话方式交代一个贴合世界背景的具体小任务，说清你会做什么，我可以怎么参与。最多150字，不要要求我写方案、凑字数或走审批流程。`;
  if (phase === 'support') return `${base}\n我选择：${WORK_APPROACHES.find(a => a.id === choice)?.detail || '一起处理'}。请用角色本人的口吻回应，简短描写你实际着手处理的事情，并给出下一步。不超过180字。不要声称操作真实钱包或修改系统时间。`;
  return `${base}\n今天的计时已结束，工作已完成。请根据上述真实互动给出简短、有性格的反馈：提到一个具体合作细节和下次相处的期待。没有互动就不要编造共同经历。不要要求额外检查，不要声称转账。最多150字。`;
}
