# Strange Loops 角色动画/运动改进提案（仅文档）

本文梳理当前角色（Achilles 与 Tortoise）从资产到运行时动画的端到端实现，评估问题并提出分阶段的改进方案。所有改动仅为提案，不包含任何源代码或资产修改。

## 现状总览（端到端）

- 源资产与生成脚本（Blender/GLB）
  - 人形（Achilles）
    - 适配与精简：`outputs/characters/optimize_mannequin.py`
    - Retarget（UAL 行走/慢跑）：`outputs/characters/retarget_ual_walk.py`
    - 早期走路细化：`outputs/characters/refine_mannequin_walk.py`
    - 原型构建（低模、动作草图）：`outputs/characters/create_characters.py`
    - Studio 文件：`outputs/characters/geb-companions-*.blend`
    - 交付资产（含 Draco）：`outputs/strange-loop/assets/characters/achilles.glb`
  - 乌龟（Tortoise）
    - Tripo 网格优化与绑定：`outputs/characters/optimize_tripo_tortoise.py`
    - 低模原型：`outputs/characters/lowpoly_tortoise.py`（在 `create_characters.py` 中调用）
    - 交付资产（含 Draco）：`outputs/strange-loop/assets/characters/tortoise.glb`
  - 资产元数据
    - 在导出 GLB 时通过 `export_extras=True` 携带 `userData`，用于写入节拍/步距等元数据（如 `walk_cycle_distance`、`jog_cycle_distance`，见 `retarget_ual_walk.py` 末尾写入对象属性）。

- 运行时加载与驱动（Three.js）
  - 角色加载与实例化：`outputs/strange-loop/src/companions.js`
    - `GLTFLoader + DRACOLoader` 载入 `achilles.glb` / `tortoise.glb`
    - 以 `THREE.AnimationMixer` 创建 `actions`（按剪辑名后缀 `Idle/Walk/Jog/Look`）
    - 从 `gltf.scene.*.userData` 读取 `walk_cycle_distance` / `jog_cycle_distance`（用于距离驱动的相位同步）
    - 角色行走路径：`exitRoute` / `entryRoute`（`outputs/strange-loop/src/chapter-passage.js`）
    - 朝向更新：根节点朝 `target` 方向进行指数平滑插值（slerp）
    - 阴影与楼地面裁剪：定制 `customDepthMaterial`，地板阴影专用（`floor-shadow`）
  - 动画切换与混合：`outputs/strange-loop/src/companion-animation.js`
    - 统一混合时长 `BLEND_DURATION = .35`
    - `Idle ↔ Walk/Jog` 在“距离驱动停下”时避免二次淡入（已做特别处理）
    - `Look` 重入保护（重复请求不会回卷）
  - 距离驱动步态与速度同步：`outputs/strange-loop/src/companion-locomotion.js`
    - `walkProgress(t)`：首尾缓入缓出、路程积分为 1 的速度曲线
    - `syncLocomotionToDistance(actor, distance, dt)`：按“单位时间内实际位移/步距”推导 `AnimationAction` 的 `timeScale` 与 `weight`，Idle 与 Walk/Jog 互补权重
    - 若无步距（如当前乌龟），仅按 `gaitRate` 调速，不进行 Idle/Walk 的权重互补
  - 触发 Look/关注目标
    - `companions.js` 暴露 `observe/react/meet`，通过设置 `target` 并播放 `Look`（根节点面向 `target`）

- 自动化质量保障（无 GPU/解码的纯逻辑核验）
  - 测试：`outputs/strange-loop/test/companion-animation.test.js`
    - 检查 Idle→Look→Idle 混合手臂不回弹
    - reduced-motion 的 Idle 首帧即稳定
    - Walk/Jog：循环无缝、脚趾支撑无滑移、无 root motion 漂移、等待时不“踩空”循环
    - 距离驱动与相位匹配、膝向/足底朝向合法、关键帧间无跳变

- 性能与渲染约束
  - 角色网格：`castShadow=true` / `receiveShadow=false`，`frustumCulled=false`（保证剪影/阴影一致性）
  - Draco 解码器：`outputs/strange-loop/assets/draco/*`
  - three 版本：`outputs/strange-loop/package.json` 中 `three@0.180.0`

## 问题清单（按可见影响排序）

1) 观察/对视仅通过“整身朝向 root 旋转”，缺少头颈级别的注视与微眼神，近景时略显“整躯扭头”的木感  
   - 位置：`companions.js` 中对 `actor.root.quaternion` 的 slerp；`Look` 为整身动作剪辑
2) Tortoise 未写入 `walk_cycle_distance`，运行时不执行 Idle/Walk 的互补权重，低速起停缺乏“趋近静止”的细腻感  
   - 位置：`companion-locomotion.js` 的“无步距早退分支”
3) Walk ↔ Jog 切换时未对步相位进行对齐，极端情况下可能在切换瞬间出现“对踏/错脚”的轻微违和  
   - 位置：`companion-animation.js` 仅基于统一淡入淡出；未做“按支撑脚相位对齐”
4) Idle 动作内容单一、节律相对平直；在展陈停留时段略显“过稳”，缺少呼吸、重心微移、随机微表情  
   - 位置：`achilles.glb` / `tortoise.glb` 的 `*_Idle` 剪辑来源于生成/retarget，未叠加细节层
5) 交互/叙事触发仅映射为 Look 或简单朝向目标，未根据章节/到达事件产生“反应型手势”（例如点头、侧身、指向）  
   - 位置：`companions.js` 的 `observe/react/meet`；`chapter-passage.js` 到达回调
6) 性能余量：角色 `frustumCulled=false` 且持续更新 Mixer。人少/场景轻时足够，但在低端移动端仍值得精打细算  
   - 位置：`companions.js` 遍历中始终 `mixer.update(dt)`（reduced-motion 已优化一次）

## 改进建议（按工作量分组）

### Quick Wins（低侵入、风险低）
- 改进注视为“头颈 LookAt 叠加层”
  - 变更：在运行时从 `gltf.scene` 缓存 `Head/Neck` 骨骼引用；在 `update()` 内对“非行走”状态将注视目标转换为头颈的局部旋转插值，限制俯仰/偏航角并缓入缓出；保留整身 `Look` 作为大幅姿态（可与头颈层叠加，优先微表情层）
  - 位置：`outputs/strange-loop/src/companions.js`（新增头颈朝向更新），无需改动 `companion-animation.js`
  - 效果：近景更自然，避免整身“扭头”；远景保持一致
  - 风险/成本：每帧多一次矩阵/四元数计算；对骨名需与资产一致（建议通过名称前缀宽松匹配）

- 为 Tortoise 写入步距元数据并启用距离驱动互补权重
  - 变更：在 `optimize_tripo_tortoise.py` 导出前，测量“单周期脚趾支撑前进量”，写入 `arm['walk_cycle_distance']`；运行时无需改动即可让 `syncLocomotionToDistance` 生效（去掉早退）
  - 位置：`outputs/characters/optimize_tripo_tortoise.py`
  - 效果：低速起停时，Walk 权重自然衰减到 Idle，停住不再有“轻踩”
  - 风险/成本：一次离线计算；动作幅度较小的乌龟需验证测距稳定性

- Idle 微变化（不破坏“抱臂/稳态”）
  - 变更：在 `achilles.glb` 的 Idle 中加入极小幅度的呼吸/重心微移（或以“Additive 动作层”方式导出）；`Look` 淡出回 Idle 时保持连续
  - 位置：`outputs/characters/create_characters.py` 或 `optimize_mannequin.py`（Idle 段）；或在 `retarget_ual_walk.py` 后追加微调
  - 效果：驻留时更“有生命”，不改变已通过的 QA（手臂折返测试需保持通过）
  - 风险/成本：需重复运行现有测试验证 Idle→Look→Idle 不回弹

### 中等工作量
- Walk ↔ Jog 步相位对齐与平滑切换
  - 变更：在触发切换时，从当前剪辑中推导“支撑脚/相位”，以该相位对齐另一剪辑的 `time` 再做双向淡入淡出；必要时缩短一次性淡入时长至 `.2s` 以减少相位偏差可见窗
  - 位置：`outputs/strange-loop/src/companion-animation.js`（在 `playCompanionAnimation` 中检测成对切换，按相位设置 `action.time` 再淡入）
  - 预期：跑/走切换不“错脚”，镜头近距离也更稳
  - 风险/成本：需在运行时读取“哪个脚在支撑期”，可能以骨骼高度/速度近似；测试需扩展

- 反应型手势（叙事/抵达/视线焦点）
  - 变更：在 `observe/react/meet` 的触发链路中，按章节/到达事件分派“点头/侧身/注目/指向”等短小剪辑，采用“Additive 层”或“上身蒙版”叠加（不破坏下肢步态）
  - 位置：`outputs/strange-loop/src/companions.js`（触发），资产侧在 `*.blend` 中输出简短手势剪辑
  - 预期：与观众/展件互动的“呼应感”显著提升
  - 风险/成本：需维护剪辑蒙版/骨骼组；与 Idle/Look 混合关系要清晰

- 低端设备的 Mixer 节流与视域剔除
  - 变更：当 `projected` 明显离屏或距离远时，降低 `mixer.update(dt)` 频率或冻结 Idle 相位；必要时将“只用于地板投影的剪影”与绑定网格分离，恢复绑定体的 `frustumCulled=true`
  - 位置：`outputs/strange-loop/src/companions.js`
  - 预期：移动端帧率更稳
  - 风险/成本：需要确保阴影/剪影的一致性；分离网格将增加一次性资产改动

### 较大工作量
- 二级运动与物理润色
  - 变更：为发束/衣褶/龟壳添加 2–3 个辅助骨骼，运行时用简易“阻尼弹簧”更新，或在 Blender 中以次要驱动烘焙为附加曲线
  - 位置：`*.blend` 资产与导出脚本；运行时在 `companions.js` 里做每帧小更新
  - 预期：近景时层次更丰富
  - 风险/成本：维护复杂度上升；需严格限制幅度避免穿插

- Retarget/剪辑物理修饰流水线升级
  - 变更：在人形动作接入 Cascadeur（或类似）进行足底/重心物理微调；对 UAL 的 Jog 做“前向姿态限制+踝部姿态约束”的自动化验证（现有测试已初步覆盖）
  - 位置：`outputs/characters/retarget_ual_walk.py` 与新增外部工具链
  - 预期：极端镜头下的膝/踝细节更可信
  - 风险/成本：外部工具引入、许可证与 CI 集成

## AI 辅助资产流水线（仅在真实贴合需求时采用）

- Tripo/Neural 重建用于“次要伙伴/远景动物”的粗几何起点（当前 Tortoise 已使用 Tripo，继续用于补充物种会很合适）
- Blender CLI 自动化（现有脚本已具雏形）：批量 retarget、测距、导出、生成 JSON 报告（`mannequin-*.json` / `tripo-tortoise-optimization.json`）
- 运动生成/拼接（Cartwheel AI/类似）：仅用于“短小反应型手势”的草案，再经 Blender 手工清理，保证循环/支撑/闭环约束
- 自动化 QA 扩展（在现有 `node:test` 基础上）：
  - 关键骨骼的“离体穿插/地面对穿”判定（采样更多相位）
  - Walk/Jog 相位对齐在切换前后 N 帧的“支撑脚一致性”判据
  - 注视层与 Idle 层叠加时的肩/颈夹角限制与突变检测

这些外部工具的接入方式、费用和失败模式，见下文「可借鉴：Lucca Cerf 的 AI 角色工厂」。默认构建不调用它们。

## 分期上线与验证

- 流水线闸门可与第 1 阶段并行，且不改变展厅画面。落地顺序见下一节末尾。
- 第 1 阶段（Quick Wins）
  - 头颈注视层、Tortoise 步距元数据、Idle 微变化
  - 验证：现有测试全部通过；新增两项测试
    - “注视层不改变 Idle 手臂折叠测试”
    - “Tortoise 低速起停的 Idle/Walk 互补权重单调性”
  - 风险：极低，运行时仅少量数学运算

- 第 2 阶段（中等）
  - Walk↔Jog 相位对齐、反应型手势触发、Mixer 节流
  - 验证：新增“切换相位一致性”与“触发手势不破步态”的测试；移动端实机对比帧率

- 第 3 阶段（较大）
  - 二级运动、外部物理润色流水线
  - 验证：加入“二级骨骼位移幅度/加速度上限”与“穿插检测”；美术主观验收

## 可借鉴：Lucca Cerf 的 AI 角色工厂

来源：[@luccacerf，2026-10-21](https://x.com/luccacerf/status/2113025837565870162)。帖文正文写的是用 Fable 5.5 调度多个 Opus 5.5 agent，搭通 Tripo P2 → Blender → Cartwheel → Cascadeur（帖文拼作 Cascadeaur）→ Unity CLI。可借用的是这条链周围的工作方式：规格与参考图、无头导出、逐剪辑清单、自动检查、浏览器预览、合并前人工放行。该次工厂运行里有两条需要记下的结果：一条剪辑因手臂穿进裙子被门禁拒绝；Blender CLI 出现过超时。

本仓库已经有对应的半条链，只是没有收成同一套闸门。乌龟外形来自 Tripo（`outputs/characters/source/tripo-tortoise.glb`，经 `optimize_tripo_tortoise.py` 绑定）。阿基里斯的 Walk / Jog 在 `retarget_ual_walk.py` 里用 Blender 重定向 Quaternius 剪辑。交付文件是 `outputs/strange-loop/assets/characters/achilles.glb` 与 `tortoise.glb`，由 `companions.js` 用 `GLTFLoader` 和 `AnimationMixer` 播放。无头播放校验今天落在 `outputs/strange-loop/test/companion-animation.test.js`，不经过 Unity。

### 可选工具、费用与已知故障

Tripo、Cartwheel、Cascadeur 保持可选，不进入 `npm test`、`npm run build` 或 `npm run release`。三者都是外部商业服务，按生成次数或席位计费，标价会变，本文不写死金额。缺密钥或额度用尽时，导出仍只跑本地 Blender 与已经入库的 CC0 / CC-BY 剪辑。

| 工具 | 在本仓库里的位置 | 默认路径 |
| --- | --- | --- |
| Tripo | 仅当需要新外形时，作为 `source/tripo-tortoise.glb` 这类源网格。现成乌龟不再重跑生成。 | 关闭 |
| Blender CLI | 已是导出本体：`create_characters.py`、`optimize_mannequin.py`、`optimize_tripo_tortoise.py`、`retarget_ual_walk.py`、`refine_mannequin_walk.py`。 | 开启 |
| Cartwheel | 只为「反应型手势」出草案，再进 Blender 清循环与支撑脚。不替换已测过的 `Walk_Formal_Loop` / `Jog_Fwd_Loop`。 | 关闭 |
| Cascadeur | 可选的足底与重心抛光，接在 `retarget_ual_walk.py` 之后、写 GLB 之前。 | 关闭 |
| Unity CLI | 该工厂的最后一站播放器。这里对应无 GPU 的 `companion-animation.test.js`，以及下面第 5 条浏览器预览。运行时仍是 `companions.js`。 | 不加入仓库 |

该工厂观察到的故障是 Blender CLI 超时。本仓库最重的一步是 `retarget_ual_walk.py`：逐帧采样、每帧三次鞋底贴地、再 Draco 导出。编排时把超时当作失败。脚本先写临时 GLB，manifest 与 QA 都通过之后再替换 `assets/characters/achilles.glb`。超时或中途退出留下上一版交付文件。

多 agent 可以分工改脚本、跑测试、写 JSON 报告。状态板只读聚合已经存在的 `outputs/characters/mannequin-optimization.json`、`mannequin-walk.json`、`mannequin-jog.json`、`tripo-tortoise-optimization.json`。不另起调度服务。替换交付 GLB 走第 6 条人工门。

### 六条想法如何落到现有文件

| # | 工厂里的做法 | 落到 Strange Loops | 工作量 | 风险 |
| --- | --- | --- | --- | --- |
| 1 | Markdown 角色规格 + 参考图作为流水线输入 | 新规格文档，指向 `DESIGN.md` 与现有预览图 | 小 | 规格和 GLB 各写一套数字后漂移 |
| 2 | 无头 Blender 重复导出 GLB 剪辑 | 收束已有 `outputs/characters/*.py` | 中 | 超时误杀重定向；半截文件覆盖交付 GLB |
| 3 | 逐剪辑 manifest | 导出脚本生成，与 GLB `extras` 对账 | 小 | 清单与 `userData` 双源 |
| 4 | 自动 QA：穿插、脚滑、循环接缝 | 扩展 `companion-animation.test.js` 与 Blender 测量 | 中 | 贴身接触被误判为穿插 |
| 5 | 浏览器逐剪辑预览，叠加状态与混合权重 | 开发页，复用 `companions.js` 的加载与 `play()` | 中 | 预览页和展厅各写一套混合 |
| 6 | 合并前的轻量人工复核 | PR 模板上的放行项；状态板只展示报告 | 小 | 勾选流于形式 |

#### 1. 角色规格与参考图

现状里，同一组数字散落在三处。`DESIGN.md` 写身高、网页比例、抱臂待机和 Tripo 乌龟的面数。`companions.js` 的 `specifications` 写 `scale`、`height`、路线起终点。`optimize_mannequin.py` 把身高归一到 2.5，`optimize_tripo_tortoise.py` 把龟高归一到 0.69。参考图已经在仓库里：`outputs/characters/mannequin-preview.png`、`tripo-tortoise-preview.png`、`companions-preview.png`，以及 `mannequin-ual-walk-preview.gif`、`mannequin-ual-jog-preview.gif`。

建议新增 `docs/characters/achilles.md` 与 `docs/characters/tortoise.md`。每份写：许可与署名（与 `THIRD_PARTY_NOTICES.md` 一致）、目标高度、网页 `scale`、骨骼命名约定、需要的剪辑（Idle / Walk / Jog / Look）、是否允许根位移、参考图路径。导出脚本读取这份规格里的高度和剪辑名单。参考图只描述当前外观，作为以后可选的 Tripo 输入；阿基里斯继续用 POLLO28 人偶，不为了“有一张参考图”就重新生成网格。

工作量小。风险是规格、Python 常量和 GLB 再次各写一份。验证：导出结束时把 GLB 的包围盒高度、`animations` 名称和规格逐项对比，不一致则脚本非零退出。

#### 2. 无头 Blender 导出

`optimize_mannequin.py`、`optimize_tripo_tortoise.py`、`retarget_ual_walk.py` 已经用 Blender 后台导入、烘焙、`export_scene.gltf` 写出 Draco GLB，并另存 `geb-companions-*.blend`。缺的是一次可重复的入口：固定输入 blend、固定脚本、固定输出路径、失败不覆盖交付文件。

建议一条本地命令依次调用现有脚本。Jog 继续走 `retarget_ual_walk.py --clip Jog_Fwd_Loop`，Walk 继续走 `--clip Walk_Formal_Loop`。针对观察到的 CLI 超时：给重定向单独设上限；超时杀进程并保留 `assets/characters/*.glb`。导出写到 `*.glb.partial`，测量与 manifest 写完再改名。`refine_mannequin_walk.py` 留作历史走路实验，不回到默认链。

工作量中。风险是超时设得比逐帧 IK 更短，把一次本可完成的重定向判失败。验证：同一输入连续导出两次，GLB 动画名、时长和 `walk_cycle_distance` 一致；人为中断时交付 GLB 的字节数不变。

#### 3. 逐剪辑 manifest

运行时用 `clip.name.split('_').at(-1)` 得到 `Idle` / `Walk` / `Jog` / `Look`。步距不在剪辑上，而在骨架 `userData`：`retarget_ual_walk.py` 写入 `walk_cycle_distance`、`jog_cycle_distance` 以及 `walk_source_clip`、`jog_license`。`mannequin-optimization.json` 只有动画名和两个周期；`mannequin-jog.json` 有秒数、帧数、离地间隙，但是单文件、单剪辑。`tripo-tortoise-optimization.json` 列出 `Tortoise_Idle` / `Look` / `Walk`，没有步距，所以 `companion-locomotion.js` 对乌龟走“无步距则只改 `gaitRate`”的分支。

建议每个交付 GLB 旁生成一份清单，例如 `outputs/strange-loop/assets/characters/achilles.clips.json`。每条剪辑包含：

- `name`：glTF 动画名，以及运行时后缀键
- `loop`：`repeat` 或 `once`（对应 `companion-animation.js` 里 Walk / Jog / Idle 循环，Look 只播一次）
- `duration`：秒
- `rootMotion`：本仓库应为 `false`（根位移属于 `chapter-passage.js` 的路线）
- `walk_cycle_distance`：模型单位；Jog 用已有的 `jog_cycle_distance` 字段，避免两个名字混用
- `tags`：`idle`、`locomotion`、`gesture` 等，供预览页过滤

清单由导出脚本写出，人手不改。`companions.js` 仍从 GLB `userData` 读步距，清单只做对账，避免运行时再解析第二份 JSON。

工作量小。风险是清单与 `userData` 分叉。验证：测试解析 GLB 动画列表，断言条数、时长、`rootMotion: false` 与清单一致；乌龟清单在补上步距之前显式写 `walk_cycle_distance: null`，避免把“缺失”写成 0。

#### 4. 自动剪辑 QA

`companion-animation.test.js` 已经覆盖脚滑（支撑趾在支撑段的位移）、循环接缝（首尾骨骼位置与四元数）、根骨骼不漂移，以及 Jog 与 Idle 混合时膝向、足底朝向。网格穿插没有测。该测试在解析前删掉 mesh 和 skin，故意不解码 Draco，因此它量不到“手臂插进身体”。

该工厂有一次门禁拒绝：手臂穿进裙子。阿基里斯的交付网格是无裙人偶，没有那条裙子；同类失败仍会发生在抱臂 Idle / Look 的前臂与躯干之间（姿态来自 `optimize_mannequin.py` 保留的折臂），以及乌龟腿与壳之间（权重在 `optimize_tripo_tortoise.py`）。若日后再启用 `create_characters.py` 里的褶裥短袍，同一道门也覆盖前臂与袍面。

建议穿插测量留在 Blender，紧挨现有的 `clearances()`：对蒙皮顶点采样前臂相对躯干、龟腿相对 Shell 的最小距离，连同脚滑与首尾接缝写入 manifest 的 `qa` 段。`node:test` 断言这些数字过线，不在单测里解码 Draco。脚滑与接缝阈值沿用现有测试（Walk 支撑趾位移 &lt; 0.025 模型单位量级、接缝 &lt; 0.001）。穿插阈值按角色分开，贴身接触不算失败，明显穿透才失败。

工作量中。风险是阈值一刀切，把折臂贴胸判成穿插，把门禁打成常红。验证：用当前已通过的 GLB 生成一份绿的 `qa`；再做一次故意把前臂插进躯干的烘焙，断言导出非零退出且不替换交付文件。这对应那次“手臂穿裙”拒绝。

#### 5. 浏览器逐剪辑预览

近景今天是 Blender 静帧和 GIF，展厅里只能在完整路线中看到混合结果。`companion-locomotion.js` 按瞬时速度把 Walk/Jog 与 Idle 的 `effectiveWeight` 做成互补，`companion-animation.js` 的淡入是 0.35 秒。这些数没有地方在画面上读出来。

建议加一个开发页，例如 `outputs/strange-loop/clip-preview.html`，不进 `index.html` 的展厅导航，也不进 `site-release` 的对外页面。页面逐条加载同一份 `assets/characters/*.glb`（含现有的 `?v=` 缓存键），调用现有的 `playCompanionAnimation`。叠加层只显示只读调试：当前 `actor.current`、剪辑时间、`timeScale`、Walk/Jog 与 Idle 的 `effectiveWeight`。滑块用于拖混合权重和距离增量，方便看起停。正式观众路径仍是 `companions.js` 的 `update()`。

工作量中。风险是预览页复制一套淡入，之后和展厅行为分叉。验证：预览页的权重曲线与 `syncLocomotionToDistance` 在相同距离序列下一致；展厅 `index.html` 不链接该页。

#### 6. 合并前的人工复核

`.github/pull_request_template.md` 已要求写清模型与动作的来源和许可。缺的是“自动检查绿了，人看过这条剪辑，才允许替换 GLB”。

建议保持轻量。PR 里附上第 5 条预览的截图或短录屏，并勾选四项：自动 QA 为绿、无新的穿插、manifest 与 GLB 步距一致、许可相对 `THIRD_PARTY_NOTICES.md` 没有变。自动 QA 失败不能用勾选覆盖。人看的是测试覆盖不到的观感：折臂是否仍像在思考、乌龟探头是否过量、Walk 换成 Jog 时是否错脚。状态板只把第 3、4 条的 JSON 摊开，不做成第二套审核系统。

工作量小。风险是勾选变成习惯性通过。验证：抽一条已知脚滑超差的临时 GLB，确认测试红、交付文件未被替换；再让一条自动检查通过但观感差的候选停在 PR，不进 `assets/characters/`。

### 建议的落地顺序

1. 第 3 条清单和第 4 条 QA 报告。只读现有 GLB 与现有脚本输出，不换剪辑。验证：当前 `npm test` 仍通过，且 manifest 与 `achilles.glb` 的四条动画对得上。
2. 第 2 条导出入口，带超时和“先写临时文件”。验证：中断不损坏现有 GLB。
3. 第 1 条规格文档，回指 `DESIGN.md` 和已有预览图。验证：高度、比例、剪辑名单三处一致。
4. 第 5 条开发预览页。验证：权重与 `companion-locomotion.js` 一致，展厅导航无入口。
5. 第 6 条写进 PR 模板的素材栏。验证：红灯剪辑无法替换交付 GLB。
6. 之后若要新的反应手势，再单独打开 Cartwheel 或 Cascadeur。Tripo 只在确定要新物种时打开。验证仍走第 4 条，外加现有的抱臂混合测试。

## 附：关键实现路径速览

- 运行时
  - 加载与实例化：`outputs/strange-loop/src/companions.js`
  - 动画切换：`outputs/strange-loop/src/companion-animation.js`
  - 距离驱动：`outputs/strange-loop/src/companion-locomotion.js`
  - 路径采样：`outputs/strange-loop/src/chapter-passage.js`
- 资产与导出
  - 人形适配：`outputs/characters/optimize_mannequin.py`
  - Retarget（Walk/Jog）：`outputs/characters/retarget_ual_walk.py`
  - 乌龟优化与绑定：`outputs/characters/optimize_tripo_tortoise.py`
  - 交付资产：`outputs/strange-loop/assets/characters/*.glb`
- 自动化验证
  - `outputs/strange-loop/test/companion-animation.test.js`

——
本文档为提案，不涉及代码或资产的直接修改。若通过评审，可按“分期上线”章节逐步实施，并在每一步扩充/通过自动化测试。 

