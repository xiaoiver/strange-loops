# 参与怪圈 · Strange Loops

简体中文 | [English](CONTRIBUTING.en.md)

欢迎提交问题、修正数学与文案、改进翻译、无障碍、性能、角色动作和章节场景。可以先从一个小问题开始；新章节、动线重做或新增依赖，建议先开 Issue 讨论体验目标和范围。

## 本地运行

需要 Node.js 22（与 CI 一致）、npm 和 Python 3。Blender 仅在修改模型、骨骼或烘焙动作时需要。

```sh
git clone https://github.com/xiaoiver/strange-loops.git
cd strange-loops/outputs/strange-loop
npm ci
npm test
npm run build
npm start
```

访问 [中文](http://localhost:4173/?lang=zh) 或 [English](http://localhost:4173/?lang=en)。`npm start` 使用 Python 在 4173 端口提供静态文件；修改后重新构建并刷新浏览器。如果端口被占用，可以自行选择其他端口运行 `python3 -m http.server`。

## 从哪里修改

| 内容 | 位置 |
| --- | --- |
| 场景与角色 | `outputs/strange-loop/src/`，如 `garden-scene.js`、`figure-ground-scene.js`、`companions.js` |
| 数学规则与进度 | `miu-system.js`、`garden-discovery.js`、`figure-ground-system.js` 及对应测试 |
| 中英文及其他语言 | `copy.js`、`garden-copy.js`、`figure-ground-copy.js`、`gallery-art.js` 和 `src/locales/` |
| 页面与样式 | `index.html`、`style.css`、`garden.css`、`figure-ground.css` |
| 模型、烘焙脚本与动作来源 | `outputs/characters/`，见[角色文档](outputs/characters/README.md) |
| 当前设计 | [PRODUCT.md](PRODUCT.md)、[DESIGN.md](DESIGN.md) 与[第二章验收记录](outputs/strange-loop/docs/chapter-02-verification.md) |

未写全的 JS 路径相对于 `outputs/strange-loop/src/`；页面和样式相对于 `outputs/strange-loop/`。

## 贡献约定

- 保留原版四条 MIU 规则及其不可达性质。内部使用 MIU，中文界面映射为 WJU；显示名称不改变存档或推导。
- 展厅对白与说明自己创作，中文术语参考商务印书馆译本；不要复制原书对白。新增图片或模型需要可再分发的授权，署名与来源链接不能代替授权。
- 新增或修改用户可见文本时，同步核对七语言与无障碍名称。日、韩使用系统字体；新增中文若触发字体覆盖错误，按[字体说明](outputs/strange-loop/scripts/subset-font.py)重建子集。
- 沿用黑白纸灰、PBR 光照、清楚的图底关系与克制动效。遵循键盘操作、系统减弱动态和无 WebGL 后备体验。
- 修改模型时保留可编辑工程、脚本、来源与许可记录，导出优化后的运行 GLB；代码许可不会自动覆盖模型。提交前阅读[许可范围](LICENSING.md)。

## 验证与提交 PR

代码修改通常需要执行：

```sh
cd outputs/strange-loop
npm test
npm run build
```

对行为变化运行相关测试；涉及场景、交互或动画时，在真实浏览器检查受影响流程。README 等纯文档修改检查链接、图片和描述即可。CI 会统一执行测试与发布校验。

界面改动请附实际浏览器截图，并说明测试过的语言与视口。截图展示当前构建；中英文文档使用对应语言的截图。序厅截图先确认 G、E、B 三个光源开启，默认雕塑使用 GEB；动画截图等待模型、字体和场景加载完成。

PR 说明应写清修改的行为、验证方法，以及已知未覆盖的设备或场景。让一次 PR 聚焦一个目标；修改源码后提交必要的构建产物。无需提交 `node_modules/`、`dist/`、本地环境变量或临时工作文件。

## 素材与贡献许可

原创代码和文档贡献按 [MIT](LICENSE) 接收，贡献者保留自己的版权，不要求版权转让。请确保你有权按该许可提交内容。

模型、字体、图片与含这些素材的截图遵循[各自许可](LICENSING.md)。添加媒体时，在 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 记录作者、原始地址、明确许可／授权依据、使用范围、修改内容和涉及的文件路径；保留应随文件分发的许可正文。授权不明确时，先提交说明或外部参考链接，等许可明确后再加入素材文件。

## 发布

`npm run release` 从已提交的干净版本生成官网子路径发布包，记录来源提交及每个文件的哈希。`LICENSE`、`LICENSING.md` 和第三方许可会随包分发。发布包不提交到 Git。

维护者通过独立的 Gallery Mate 同步 PR 更新官网，流程见[部署指南](outputs/strange-loop/docs/deploy-gallerymate.md)。普通贡献不需要生产凭据或部署权限。
