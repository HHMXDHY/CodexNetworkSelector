# Codex 网络稳定选择器

跨平台桌面工具，自动发现 Clash/Mihomo，递归展开代理组及其嵌套组，测试节点对 Codex/ChatGPT API 与 WebSocket 的稳定性，并在真实传输验收后选择最佳节点。

## 当前版本

`1.0.0`。版本遵循 SemVer：修复递增 patch，兼容功能递增 minor，破坏性变更递增 major。每次发布必须同步更新 `package.json` 与 `CHANGELOG.md`，以 `vX.Y.Z` 标签触发双平台构建。

## 本地开发

```powershell
npm ci
npm start
npm test
npm run pack:win
```

Windows 产物位于 `dist/`，包含安装版与便携版。macOS 产物由 GitHub Actions 的 `macos-latest` 原生构建，包含 DMG 和 ZIP。

## 自动发现

- Windows：Clash Verge Rev/Mihomo 命名管道，然后尝试 `127.0.0.1:9090/9097`。
- macOS：常见 Mihomo Unix Socket，然后尝试 `127.0.0.1:9090/9097`。
- 开启 Secret 的控制器可在设置中填写。

## 发布

```bash
npm version patch   # 或 minor / major
git push --follow-tags
```

推送 `v*` 标签后，CI 在 Windows 和 macOS 分别编译并上传构建产物。Apple 公证需在仓库 Secrets 配置开发者证书与公证凭据；未配置时产物可构建，但首次打开会受到 Gatekeeper 提示。
