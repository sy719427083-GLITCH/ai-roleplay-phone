export function getWorkNextStep(project, remaining) {
  if (project.salaryPaid) return { label: '开始下一天', hint: '工资已到账，可以收工了。', target: 'ws-next-day' };
  if (project.delivered) return { label: '重试工资结算', hint: '成果已交付，工资尚未结算，请重试。', target: 'ws-delivery' };
  if (!project.accepted) return { label: '去确认需求', hint: '先确认今日委托，开始工作计时。', target: 'ws-brief' };
  if (!project.researched) return { label: '去整理资料', hint: '下一步：点击「整理背景资料」。倒计时结束不会自动完成工作步骤。', target: 'ws-research' };
  const count = project.draft.trim().length;
  if (count < 30) return { label: '去写方案', hint: `下一步：填写至少 30 字的方案草稿，目前 ${count} 字，还需 ${30 - count} 字。`, target: 'ws-draft' };
  if (!project.reviewed) return { label: '去检查方案', hint: '草稿已满足字数要求，点击「交付前检查」即可继续，无需额外等待。', target: 'ws-review' };
  if (remaining > 0) return { label: '等待计时完成', hint: '检查已通过，工作倒计时归零后即可交付领薪。', target: null };
  return { label: '去交付领薪', hint: '计时与检查均已完成，点击「提交成果」领取工资。', target: 'ws-delivery' };
}
