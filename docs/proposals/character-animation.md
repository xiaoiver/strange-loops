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

## 分期上线与验证

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

