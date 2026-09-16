export function getWorkNextStep(project, remaining) {
  if (project.salaryPaid) return { label: '开始下一天', hint: '工资已到账，共同经历已记录。', target: 'ws-next-day' };
  if (project.delivered) return { label: '重试工资结算', hint: '工作已完成，工资尚未结算，请重试。', target: 'ws-delivery' };
  if (!project.accepted) return { label: '开始今天的工作', hint: '和搭档接下工作，计时期间可以一起处理小插曲。', target: 'ws-brief' };
  if (remaining > 0) return { label: '和角色一起处理', hint: '工作正在推进，可以找搭档商量或请对方分担。不用写方案、手动检查。', target: 'ws-support' };
  return { label: '去收工领薪', hint: '工作时间已到，直接收工即可领工资。', target: 'ws-delivery' };
}
