# 版本与发布规则

- 使用语义化版本 `MAJOR.MINOR.PATCH`。
- `PATCH`：错误修复和探针兼容性调整。
- `MINOR`：向后兼容的新功能、新 Clash 客户端适配。
- `MAJOR`：配置格式或行为发生破坏性变化。
- 每次发布必须通过 `npm test`，更新 `CHANGELOG.md`，并创建 `vX.Y.Z` Git 标签。
- 标签触发 `.github/workflows/release.yml`，在原生 Windows/macOS runner 上分别构建。
- Windows 正式公开发布前应配置 Authenticode 证书；macOS 正式公开发布前应配置 Apple Developer ID 与公证凭据。

发布入口：

```powershell
.\scripts\release.ps1 -Bump patch
```
