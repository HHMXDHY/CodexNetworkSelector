param(
  [Parameter(Mandatory=$true)]
  [ValidatePattern('^(major|minor|patch)$')]
  [string]$Bump
)
$ErrorActionPreference = 'Stop'
if (git status --porcelain) { throw '工作区不干净，请先提交当前修改。' }
npm test
npm version $Bump
Write-Host '版本号和 Git 标签已生成。请补充 CHANGELOG.md 后运行：git push --follow-tags'
