import React from "react";
import { createRoot } from "react-dom/client";
import { ProjectCountdownView } from "./ProjectCountdownView.jsx";
import "./office.css";

const project = {
  id: "qa-project",
  name: "品牌视觉升级",
  amount: "¥2,100",
  amountValue: 2100,
  duration: "3 天",
  durationHours: 72,
  difficulty: "困难",
  description: "完成品牌定位与竞品视觉分析，建立 Logo、标准色、字体与版式规范，并设计 6 张社交媒体模板与 3 套应用延展。",
  scopeItems: [
    "完成品牌定位与竞品视觉分析",
    "建立 Logo、标准色、字体与版式规范",
    "设计 6 张社交媒体模板与 3 套应用延展",
  ],
  deliverables: "品牌视觉手册 1 份、可编辑源文件、PNG/JPG 导出包。",
  acceptanceCriteria: "规范完整、源文件可编辑、交付清单全部通过。",
};

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ProjectCountdownView
      timer={{ status: "running", remainingSeconds: 67336, progressPercent: 74, display: "18:42:16", project }}
      endsAt="2026-07-28T10:30:00.000Z"
      claiming={false}
      error=""
      onBack={() => {}}
      onOpenProjects={() => {}}
      onClaim={() => {}}
    />
  </React.StrictMode>,
);
