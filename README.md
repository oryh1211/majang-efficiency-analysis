# majang-efficiency-analysis

牌研所是面向雀魂三麻、四麻的日麻牌效率分析工具。上传整桌截图后，可点图校对手牌、牌河和副露，比较前三切和已确认的吃碰杠选项。截图识别和本地校对学习在浏览器内处理。

## 运行

静态预览可直接打开 `dist/index.html`。自愿贡献功能由 Worker 提供，部署时在 Node.js 24 下运行 `node server/build.mjs`，以生成 `dist/server/index.js`。配置 D1 的 `DB` 绑定、应用 `drizzle/0000_contributions.sql`，并将独立生成的 `SAMPLE_SOURCE_SECRET` 配为 Worker 密钥。通用模板尚未接入跨用户样本自动更新。

## 测试

- [行动建议和贡献服务验收](tests/actions-and-contributions.md)
- [本地学习实图回归](tests/local-learning.md)
- [模板授权说明](dist/board-templates.NOTICE.txt)
