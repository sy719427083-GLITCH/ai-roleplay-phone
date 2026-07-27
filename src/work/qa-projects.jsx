import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ProjectManagementPreview } from "./ProjectManagementPreview.jsx";
import "./office.css";

const projects = [
  ["智慧园区能耗监测系统建设项目", 1280000, 1920, "困难", "负责智慧园区水、电、气等能耗数据的实时采集、监测、分析与告警，并提供可视化管理平台及相关技术文档。"],
  ["数据中台指标体系优化项目", 860000, 1440, "中等", "梳理核心业务指标口径，完成数据模型优化、质量校验与管理看板升级。"],
  ["客户服务流程数字化项目", 520000, 960, "中等", "重构客户服务流程，交付工单系统、知识库与服务质量分析方案。"],
  ["品牌内容资产管理项目", 360000, 720, "简单", "建立品牌内容分类、审核、检索与复用规范，并完成首批资产迁移。"],
  ["供应链协同平台升级项目", 980000, 1680, "困难", "升级供应商协同、采购计划、履约监控与异常预警能力。"],
].map(([name, amountValue, durationHours, difficulty, description], index) => ({
  id: `qa-project-${index + 1}`,
  name,
  amountValue,
  amount: `¥${amountValue.toLocaleString("zh-CN")}`,
  durationHours,
  duration: `${durationHours} 小时`,
  difficulty,
  description,
  scopeItems: [description, "交付完整源文件", "通过项目验收"],
  deliverables: "项目交付包与技术文档。",
  acceptanceCriteria: "交付内容完整并通过验收。",
}));

function ProjectQa() {
  const [projectState, setProjectState] = useState({
    projects,
    startedProjectId: null,
    startedAt: null,
    endsAt: null,
    revision: 0,
    source: "main",
    generatedAt: "2026-07-27T08:00:00.000Z",
  });

  return <ProjectManagementPreview onBack={() => {}} projectState={projectState} onProjectStateChange={setProjectState} />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ProjectQa />
  </React.StrictMode>,
);
