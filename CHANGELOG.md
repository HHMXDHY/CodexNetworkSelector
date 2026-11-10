# Changelog

本项目遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [1.0.2] - 2026-11-10

### 修复
- 禁止构建阶段隐式发布 GitHub Release，由工作流的发布任务统一上传产物。
- 避免标签构建因构建任务的只读令牌权限而收到 GitHub 403。

## [1.0.1] - 2026-11-10

### 修复
- 修复 macOS Bash 提前展开 electron-builder 文件名模板、导致 DMG 构建失败的问题。
- macOS DMG 与 ZIP 统一使用 electron-builder 原生跨平台文件名模板。

## [1.0.0] - 2026-11-06

### 新增
- Windows 与 macOS 共用的 Electron 桌面应用。
- 自动发现 Clash Verge/Mihomo 命名管道、Unix Socket 和本地控制端口。
- 并行检测 Codex API 与 WebSocket，综合成功率、P90 和抖动评分。
- 仅在候选完整通过真实传输验证后切换节点。
- 官方不支持地区规则与伪节点过滤。
- 无控制台、无 curl 弹窗的后台检测。
- Windows 安装版、便携版，以及 macOS DMG/ZIP 构建配置。
