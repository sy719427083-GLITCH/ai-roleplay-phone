# GitHub Pages 发布源修复设计

## 目标

让线上站点只发布 GitHub Actions 构建出的 `dist`，避免仓库现有的 `main/docs` 旧发布源覆盖新版本。同时把应用版本从 `0.3.7` 升级为 `0.3.8`。

## 根因

GitHub Actions 已从提交 `72d94cd` 成功构建并上传了包含项目倒计时功能的 `dist`，但仓库 GitHub Pages 设置仍为 legacy 模式，发布源是 `main/docs`。因此线上最终读取的是旧 `docs` 内容，而不是 Actions 上传的构建产物。

## 修复方案

1. 将 GitHub Pages 的构建类型从 legacy 切换为 workflow，使 `.github/workflows/deploy-pages.yml` 成为唯一发布源。
2. 将 `package.json`、`package-lock.json` 和项目现有发布标记统一更新为 `0.3.8`。
3. 运行完整测试和生产构建。
4. 提交并推送 `main`，等待 Pages 工作流完成。
5. 直接请求线上 HTML 和带哈希的静态脚本，确认线上引用本次构建文件，并确认脚本包含“项目倒计时”“工作结束”“点击领取报酬”等新功能文本。

## 失败处理

- 如果 Pages 设置无法切换，停止部署并报告权限问题，不再继续让两套发布源并存。
- 如果工作流失败，以失败步骤为准修复，不把旧 `docs` 当作回退发布源。
- 如果工作流成功但线上仍引用旧哈希，继续检查 Pages 部署状态和 CDN 响应，不能仅凭 Actions 成功状态宣告完成。

## 验收标准

- GitHub Pages API 显示 `build_type` 为 `workflow`。
- 应用版本为 `0.3.8`，相关版本断言通过。
- 完整测试和生产构建通过。
- 线上 HTML 引用本次构建生成的 JS/CSS 哈希。
- 线上 JS 包含项目倒计时和领取报酬功能。
