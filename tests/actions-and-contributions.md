# 吃碰杠与自愿贡献验收

在 PowerShell 使用已准备好的真实样本，或通过 `tests/prepare-p0.ps1` 和 `-IncludeVisionHoldout` 下载并转换。用 `tests/p0-sources.json` 查找每张原图。

```powershell
node tests/actions.cjs .vision-research
node tests/p0-regression.cjs .vision-research
node tests/contributions.mjs
node tests/vision-eval.cjs .vision-research
node server/build.mjs
```

## 行动建议

| 场景 | 真图 | 验证结果 |
| --- | --- | --- |
| 四麻吃与跳过 | sample-chi2-6 → sample-chi2-7 | 读取吃和跳过按钮，并定位上家七万。首帧仍有一张牌河黄标。下一帧回到吃后待切。该图用于开发按钮模板。 |
| 三麻碰白 | sample-pon-3 → sample-pon-4 → sample-pon-7 | 第一帧回放未显示按钮，确认响应和被鸣白板后可比较碰与过，碰后禁打白。第二帧回到待切，第三帧无出牌建议。第三帧是同局后续帧，尚未核实紧接切牌的连续性。 |
| 暗杠 | sample-kan-5 | 显示杠按钮的四麻原图，读取按钮，对比暗杠与继续出牌。河中一处须人工校对。用规则用例检查摸入第四枚、等待不变和禁止送杠。 |
| 加杠 | sample-kakan-2 | 已有白板碰且摸入白板，确认杠权限后可比较加杠与出牌。 |
| 大明杠 | sample-openkan-5 | 顶部牌河存在漏读。用真图的手牌和人工标注的赤五索验收引擎，原图尚不能独立确认行动。 |
| 四麻多吃法 | 构造牌姿 | 对比两种吃法、喰替差异及末张禁止。尚缺真实多吃法截图。 |

立直后暗杠规则参考[雀魂官方 FAQ](https://mahjongsoul.com/faq/)。客户端按钮模板目前只覆盖上述已知样式。响应选项仍需确认完整性，含荣和时暂停比较。切牌时机不明、牌河有黄标或被鸣牌位置不明时暂停出牌建议。

## 跨用户贡献

- SQLite 使用与服务端相同的 SQL 验证尺寸、字段白名单、限流、精确及近邻去重、冲突隔离。来源使用服务器密钥和连接地址派生，仅用于限流和一致性证据，本身不证明是不同牌局。
- 自动筛选给出候选组。空位进入贡献库，首期不生成移除模板。现有独立集有 6 张图、5 张待切和 138 张标注牌面。没有证实跨牌局纠错收益的贡献模板，因此未发布通用模板。
- 灰桌和真白板保护可重跑 `node tests/local-learning.cjs .vision-research`。新贡献未进入识别。额外的线上灰度路由、真实白板和末端舍牌专项门禁、独立跨牌局纠错与实际回滚应在证据齐备后验收。
- 回滚单测模拟合格候选进入 5% 灰度，再因漏牌退化返回上一版。这个测试检验纯发布决策，未触发线上模板切换。
