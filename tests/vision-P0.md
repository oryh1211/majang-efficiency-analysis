# 雀魂截图识别 P0 验收

基准版本为 `a6c28e8`。下表使用最终独立验收集的 6 张真图，其中 5 张是自家待切、1 张是他家回合。验收图仅用于人工标注和最终对照。第一批试跑图发现了高亮白板和九筒指示牌的边界问题，随后转入调试集，未纳入下表。图像未随源码分发。

| 指标 | 旧版 | 本次 P0 |
| --- | ---: | ---: |
| 逐张准确率（已标注手牌、四家牌河、指示牌与自家副露） | 137/138（99.3%） | 137/138（99.3%） |
| 错读但未标黄（以有错读输出的牌为分母） | 0/1 | 0/1 |
| 整桌无需校对且可出建议（自家待切图） | 4/5（80%） | 4/5（80%） |
| 有效截图被拒绝 | 0/5 | 0/5 |
| 非待切截图误出建议 | 0/1 | 0/1 |

逐张按牌区和顺序比对，包含赤牌属性，漏牌计入准确率分母。两版在此集均无漏牌和多读。整桌通过还要求正确识别出牌时机、三四麻、立直和被鸣牌，并且分析器成功给出建议。非待切图仅用于时机验收。小样本用于对照回归，无法估计总体表现。

## 调试样本复测

- 用户九索暗杠、发财碰原图，自家牌河第三张仍读为五万并标黄。点图校对后保留其他识别和校对结果。
- 用户东四局十四张手牌截图，下家牌河第六张的近似万子旧版未提示，当前明确标黄。
- 加杠灰桌，四家牌河从旧版读出的 46 张收敛为原图的 12 张，较暗的九索仍标黄。 [实战来源](https://note.com/shinux217/n/n42348a994488)

最终验收图及逐区人工标签见 [vision-holdout.json](vision-holdout.json)。包括 [三麻实战](https://note.com/kyuuuuuuuuuso/n/n118072d2eba3)、[四麻回放](https://note.com/okuohouko/n/ne234c5c7354c) 和 [三麻提供牌谱](https://note.com/okuohouko/n/n06597f611232)。

## 复跑

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/prepare-p0.ps1 -MixedScreenshot "C:/path/to/original.jpg" -IncludeVisionHoldout
New-Item -ItemType Directory -Force .vision-research/baseline-a6c28e8 | Out-Null
git archive --output=.vision-research/baseline-a6c28e8.tar a6c28e8 dist
tar -xf .vision-research/baseline-a6c28e8.tar -C .vision-research/baseline-a6c28e8
node tests/vision-eval.cjs .vision-research .vision-research/baseline-a6c28e8/dist dist
node tests/p0-regression.cjs
```

典型仍需校对的情况包括全遮挡的牌河尾端、相近万子、赤五着色不清、横放牌几何不确定，以及无法读全的副露。P1 的三方向三麻座位覆盖、完整混合副露、真实连续三帧暂未达到独立验收覆盖。
