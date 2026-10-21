# 怪圈 · 序厅与两章漫游

《集异璧》原创致敬叙事展。包含真实三维 G/E/B 交集雕塑、三束正交平行光和实时阴影、三个观察方向、拖动观察、章节地图，以及可玩的 WU / MU 花园与图形与衬底画廊。第三章及后续章节尚未开放，漫游地图置灰，右侧保留章节主题。制作计划见 `docs/chapter-02-plan.md`。

## 语言与文案

右上角 EN / 中文切换覆盖标题、原创角色对白、章节地图、第一章规则与观察线索、灯光和观察方向的无障碍标签。默认中文，通过 `localStorage` 的 `geb.locale` 记住选择；切换时保持视角、灯光与所在页面。

双语文本集中于 `src/copy.js`。中文参考商务印书馆术语 WU谜题、和声小迷宫、图形与衬底、艾舍尔；英文保留 MU-puzzle、Little Harmonic Labyrinth 等对应名称。文案均为原创，非原书引文。主线围绕形式、意义、自指与心智；阿基里斯采用用户提供、POLLO28 制作的 CC BY 4.0 人偶模型，经 Blender 减面和动作适配；乌龟采用用户提供的 Tripo 生成网格，经 Blender 清理、减面和骨骼绑定。人偶署名与许可链接放在中英文章节地图和仓库 THIRD_PARTY_NOTICES.md。

简介中的中文书名链接至商务印书馆官方介绍，英文 GEB 链接至英文维基百科书籍介绍。链接在新标签页打开，保留当前展厅。

## 预览

在此目录运行 `python3 -m http.server 4173`，然后访问 http://localhost:4173 。需通过 HTTP 打开，不能直接双击 HTML。网页成品已经构建，预览不需要安装 Node 依赖。

## 修改

`npm install` 后运行 `npm run build`，把 `src/main.js` 构建为 `assets/app.js`。页面布局在 `index.html`，样式在 `style.css`。更新发布版本时同步修改 HTML 中 CSS/JS 的版本查询参数，避免预览缓存。

## 第一章：WU 花园

- `src/miu-system.js` 是纯规则与历史引擎。内部统一使用 MIU / MI / MU，中文展示为 WJU / WJ / WU，语言切换不改推导数据。
- 保留原版四条规则。点击立即执行，多处符合时默认改写最左一处，不再展示位置选择列表；悬停和键盘焦点预览实际作用范围。
- 默认先完成可达的 WUJU：复制两次、添 U、三 J 换 U，四次点击后进入不变量发现环节。下一步建议和规则高亮共用 `garden-hints.js`。
- 界面不展示历史、分支和步数；仅保留提示、退一步与重新开始。内部仍用父子节点保存合法推导，重复边复用原节点，存档恢复时逐步验算。`geb.garden.v1` 保留旧推导；`uiVersion: 3` 记录目标选择与 `discovery` 阶段（count / groups / rules / complete）。
- 小目标之后保留当前推导，依次数 J、每三个分组、检查四条规则对余数的影响。实时数量与分组随改写和撤销同步；不再推荐为不可达目标不断复制。
- 选出不变量理由才标记本章完成；“试过很多次”只显示解释，不会通关。完成页收起规则操作，提供下一章预告与可选自由探索。完成状态随语言切换、返回和刷新保留；旧版挑战进度直接进入数量观察，原推导保留。
- 操作区限制单串 192 字符、600 个内部节点；超限可退一步或重新开始，不改变数学规则。重新开始有独立确认。
- `src/garden.js` 负责 DOM 操作、键盘焦点与对话框；`src/garden-copy.js` 保存原创双语对白；`garden.css` 负责可滚动的小屏布局。`src/garden-scene.js` 提供字母堆与同步操作字串，角色继续使用现有 GLB。
- 三维场景不可用时仍可完整操作规则；减少动态效果模式跳过镜头过渡与角色行走。第二章可由地图或下一章按钮进入。

中央高台已移除。144 个石墨灰字母由 cannon-es 模拟重力与碰撞，堆成小山；每次进入第一章时，上层 48 个字母从半空落下，撞击底部并重新堆稳；操作字串单独排列在前方地面，随改写移动。真实顶光穿过矩形狭缝，在墙地形成连续亮带；墙面开出有纵深的门洞，门楣同步当前目标。地面不展示推导足迹，推导历史仅用于内部撤销与存档。减少动态效果时直接更新状态。

悬停或键盘聚焦规则时预览实际作用范围：I 标出末尾字母，II 标出首字母后的整段，III 标出三个字母，IV 标出两个字母。多处匹配时预览默认改写的最左一处。

Esc 优先关闭弹窗与章节地图；在花园内先收起提示，最后才返回序厅。

运行 `npm test` 验证动画字母来源映射、四条规则、重叠匹配、可达练习、分支保留、存档验证、展示限制、数量变换、不变量与完成条件。发布前还应在浏览器走通小目标、计数与撤销、分组、错选与正确理解、完成恢复、语言切换、自由探索和窄屏布局。

## 渲染

- Three.js WebGL2，MeshStandardMaterial PBR 石墨灰材质。
- PMREM + RoomEnvironment 提供环境反射。三束正交 DirectionalLight 分别沿 Z、X、Y 轴照射同一件雕塑，使用实时 shadow map；G、E 分别落在两面墙，B 落在地面。没有使用字形贴图或合成轮廓，光源可独立开关。
- 默认开启 PCSS 柔光阴影：根据遮挡物深度估算半影，接近接收面时更锐利，距离增大时更柔和。桌面使用 16 次遮挡搜索及 48 次过滤，移动端为 12 / 24 次。使用接收面深度梯度修正，减少自阴影条纹；这是实时阴影贴图近似，不是路径追踪。柔光固定开启，不提供界面开关。
- GTAOPass 实时屏幕空间环境遮蔽，Poisson 降噪，OutputPass 色调映射和 FXAA。
- 根据用户选择不使用景深，保留雕塑的清晰轮廓；墙面阴影的柔化来自 PCSS。
- 雕塑为三个互相垂直的字形挤出体的布尔交集；模型使用自定义 Int16 量化二进制（约 700 KB），不是 glTF，因此不用 Draco；角色网格才走 Draco。
- 限制设备像素比以控制移动端开销；支持减弱动态和 WebGL 不可用时的文字入口。
- 桌面渲染像素比最高 2×，手机（宽度不超过 760px）最高 1.25×，均不超过屏幕原生 DPR。窗口尺寸或屏幕 DPR 变化时，画布和后处理使用相同的整像素分辨率，FXAA 的采样步长同步更新。

序厅保持安静，不提供音频试听或播放控件。中文字体使用自行托管的 Noto Serif SC 子集（派生名 Strange Loops Serif SC），保留 400–700 字重，回退到本地宋体。没有使用书封、原书对白或埃舍尔图像；第二章按用户要求引用两款署名电影海报用于负空间评论。

## 生成模型

默认雕塑由构建脚本写出：`npm run sculpture`（或 `node scripts/generate-sculpture.mjs [ABC]`），再 `npm run build`。字形来自 Three.js 示例的 Helvetiker Bold（仅拉丁大写）。

序厅提供三字输入框：访客可输入任意 A–Z 三连，在 Web Worker 中用同一套 CSG 求交替换网格，并刷新阴影。视角展签按字母显示书中相关彩蛋人名（角色、引用思想家与意象，如螃蟹、蒯因、芝诺）；分享链接支持 `?s=CAT`；失败（空网格等）会保留当前雕塑并提示。点击字母生成区的下载图标可直接导出当前雕塑为 STL（本地坐标）。输入要求仅在校验失败时提示，下载图标在悬停或键盘聚焦时显示说明。`npm run build` 会同时打包 `assets/app.js`、`assets/sculpture-worker.js` 与 `assets/letter-pile-worker.js`。

首屏精简：保留主标题、单句引导和入口；移除重复展签、标签及页脚标语。对白在切换视角或拖动后出现，恢复漫游视角时收起。完整书名和原创对白说明仍在章节地图内。

已移除右下角的独立漫游播放/暂停按钮，保留拖动和 G/E/B 视角切换。场景仍遵循系统的减弱动态偏好。

同行者模型详见 ../characters/README.md。乌龟由用户提供的 Tripo 网格从 15,515 减至 598 个三角面，保留造型、灰色哑光材质与平面法线。角色 GLB 经 Draco 压缩（阿基里斯约 244 KB，乌龟约 85 KB），运行时用本地 `assets/draco/` 解码；当前乌龟生成脚本直接导出压缩 GLB。两个模型具有骨骼与 Idle / Walk / Look 动画，角色标签和对白支持中英文；点击人物可交谈。首次载入短距离行走后停留，不持续循环走动。序厅与第一章往返时角色保留当前位置与待机动作，仅平滑调整朝向；第一章到第二章仍沿门洞路线行走。模型加载失败不会阻断序厅和其他交互。

停留时使用缓慢循环的骨骼待机动画：阿基里斯约 14 秒一段，抱臂呼吸、上身轻移和间歇转头；乌龟约 18 秒一段，包含探头、侧望和轻动前肢。交谈后恢复待机，转头与待机使用等长交叉淡化，避免混入张臂默认姿态而重复抱臂；减少动态效果时首帧直接显示完整姿态。角色和 G/E/B 触发的对白共用固定的正文起点，避免文本长短或说话人变化造成跳位。

G/E/B 的观察按钮已改为字母加人名的展签，手机与桌面都默认显示；中文术语使用哥德尔、艾舍尔、巴赫，英文对应 Gödel、Escher、Bach。无障碍名称与悬停提示同时包含人名和观察方向。

官网子路径发布命令为 `npm run release`，详见 `docs/deploy-gallerymate.md`。`?lang=en` / `?lang=zh` 可固定分享语言。

## 字母堆物理模拟

字形轮廓被拆成保留空洞的凸多面体组合，使用固定 1/60 秒步长。模拟在独立 Web Worker 中运行，离开第一章或页面隐藏时暂停；重新进入章节会重播上层字母落下，切回浏览器标签则接着原状态运行；全部字母静止后结束 Worker。Three.js 使用八组 InstancedMesh，并对物理快照插值。

减少动态效果或 Worker 不可用时使用 `src/letter-pile-rest.json`，这是同一物理引擎生成的静止结果。调整字形、数量、随机种子或物理参数后，运行 `npm run letter-pile` 重新生成，再执行 `npm test` 和 `npm run build`。

## 首次加载

HTML 内置纸灰加载屏，在主脚本下载前即可显示。雕塑、同行者、字体及分享字母生成完成后，先渲染首帧再淡出；等待时展厅控件保持 inert。12 秒仍未完成会显示重试入口，主脚本失败也可重新加载。关键雕塑请求与可选模型等待有 20 秒期限，字体等待最长 8 秒；三维失败后退出遮罩，保留文字玩法。减少动态效果时不播放加载条和淡出动画。


### Languages

The exhibit supports Chinese (`zh`), English (`en`), Japanese (`ja`), Korean (`ko`), French (`fr`), German (`de`) and Spanish (`es`). The header selector updates `?lang=` while preserving the sculpture query and chapter progress. Shared URLs take precedence over the saved preference; unsupported language codes fall back safely.

New original translations live in `src/locales/`. The mathematical engine always uses MIU; Chinese displays WJU, while the other six languages display MIU. Japanese and Korean use system fonts for their respective scripts. Existing published translations of the book are not quoted.

The loader is authored in `src/loading.js` and bundled inline by `scripts/build-loading.mjs` during `npm run build`, so localized loading and retry messages work even if the main bundle fails. Do not edit the generated inline loader directly. Release output includes a static page and metadata for each language; the host must select the matching file for `?lang=`.

## 第二章：图形与衬底

可从地图或第一章的下一章按钮进入。两位角色穿过 WU／MU 出口，经侧墙入口来到《龙虾》双海报前，再走向 Rubin 共边墙，观察两张侧脸之间的花瓶形留白。页面上的美术馆式展签介绍设计者、年份和来源。看过共边墙后可回看海报，或打开下一章预告；当前不展示数字墙、数学问答或完成标记。七种语言共享观察进度，旧存档自动回到对应展品；无 3D 时使用 SVG 与 HTML 游览。素材来源见仓库 THIRD_PARTY_NOTICES.md。

阿基里斯的 Walk 已改为足底接触约束的慢走：脚跟落地、脚尖蹬地、骨盆重心变化与反向摆臂。每轮 1.2 秒，网页按实际行进距离推进动作，低速起停与 Idle 混合；路线中段保持稳定速度，抵达后回到待机。可编辑工程与渲染预览见 `../characters/geb-companions-walk.blend`、`../characters/mannequin-walk-preview.gif`。
