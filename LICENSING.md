# Licensing scope / 许可范围

[English](#english) · [简体中文](#简体中文)

## English

### Original software and documentation

The [MIT License](LICENSE) applies to this project's original software, development scripts, tests, HTML/CSS, original interface and narrative text in source files, and original technical documentation. This includes the original contour definition in `outputs/strange-loop/src/rubin-contour.js` and its generated `assets/art/rubin-contour.svg`.

MIT permits commercial use, modification and redistribution, including closed-source reuse, while requiring preservation of its copyright and license notice. Contributors retain copyright in their contributions. Third-party components and the assets below retain their own terms; a top-level MIT notice does not relicense them.

### Assets and third-party components

Paths below are relative to `outputs/strange-loop/` unless another prefix is shown. The release package uses the same runtime asset paths. Detailed attribution and upstream license texts are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

| Material | Applicable terms |
| --- | --- |
| POLLO28 Achilles mannequin, `assets/characters/achilles.glb`, and `outputs/characters/source/pollo28-mannequin.glb` | The model and adapted mesh retain **CC BY 4.0**. Preserve POLLO28 attribution, the source/license links and modification notice. Animation sources are credited separately below. |
| Quaternius Formal/Jog source clips in `outputs/characters/source/quaternius-*.glb` and their adapted animation data | Source animation package: **CC0 1.0**. Keep provenance with the accompanying files; the mannequin mesh still has its separate terms. |
| Tripo tortoise, `assets/characters/tortoise.glb`, `outputs/characters/source/tripo-tortoise.glb`, and adaptations of that model | The maintainer confirms generation on a **paid plan with the model set to private**. The project grants **no separate reuse license for this model** through MIT. Obtain permission from the maintainer before redistributing the tortoise; generation provenance alone is not an open-content license. [Tripo terms](https://www.tripo3d.ai/terms). |
| `assets/art/the-lobster.jpg`, `assets/art/the-lobster-weisz.jpg` | Third-party film posters, **excluded from MIT**. Rights remain with their respective holders. Attribution, a source link and this repository's commentary do not grant permission to reproduce or sublicense the posters. |
| Noto Serif SC subset in `assets/fonts/` | **SIL Open Font License 1.1**, with the upstream notice in `assets/fonts/OFL.txt`. |
| Helvetiker/Optimer font data and glyph geometry derived from those typefaces, including the bundled sculpture and letter meshes | Retain the **Magenta font license** and upstream notices recorded in THIRD_PARTY_NOTICES. MIT covers the project's generator code, not a replacement license for the source typefaces. |
| Google Draco JS/WASM decoders in `assets/draco/` | **Apache-2.0**; the upstream license is preserved in `assets/draco/LICENSE`. |
| Three.js, three-bvh-csg, three-mesh-bvh, cannon-es and PQINA Flip code in the generated bundles | Their upstream **MIT** notices remain applicable and are preserved in THIRD_PARTY_NOTICES. |
| Screenshots, share images, Blender projects, animation previews and other files containing the assets above | **No blanket MIT asset license.** Underlying model, font and artwork rights remain applicable. Images containing the posters are excluded from the project MIT grant. The original code inside a mixed project remains MIT. |

No other model, illustration or media file is granted an open-content license merely by being present in this repository. Check its recorded terms or contact the maintainer. This scope statement does not limit rights already granted by an upstream license, applicable law or the public domain.

### Redistribution and contributions

Redistributing the software requires retaining LICENSE and the relevant third-party notices. A website release includes LICENSE, this scope statement, THIRD_PARTY_NOTICES, and the bundled font/decoder license files. These files describe permissions; they do not supply missing third-party permissions.

New original code and documentation contributions are accepted under MIT. Contributed media must have its own documented, compatible redistribution permission. See [CONTRIBUTING.en.md](https://github.com/xiaoiver/strange-loops/blob/main/CONTRIBUTING.en.md). The project does not grant rights to the GEB book, Escher's artworks, or third-party names and trademarks.

## 简体中文

### 原创代码与文档

[MIT 许可证](LICENSE)适用于本项目原创软件、开发脚本、测试、HTML/CSS、源文件中的原创界面与叙事文案，以及原创技术文档。原创 Rubin 轮廓定义 `src/rubin-contour.js` 与生成的 `assets/art/rubin-contour.svg` 也在此范围内。

MIT 允许商用、修改和再分发，包括闭源复用，要求保留版权与许可声明。贡献者保留自己贡献的版权。它不替代第三方组件、模型、字体、海报等素材已有的许可。

### 素材边界

- **阿基里斯模型**：保留 POLLO28 的 CC BY 4.0，保留作者、来源、许可链接和修改说明；模型中的动画另有来源。
- **Quaternius 动画**：源包使用 CC0 1.0；模型网格仍遵循自己的许可。
- **Tripo 乌龟**：维护者已确认使用付费方案并设为私有生成。MIT 不为该模型另行授予复用许可；再分发请联系维护者，生成来源记录不等于开放素材许可。
- **《龙虾》海报**：排除在 MIT 授权之外，权利归各自权利人。标注作者与来源不等于获得复制或转授权许可。
- **字体与字形网格**：Noto Serif SC 子集保留 OFL 1.1；Helvetiker、Optimer 及其衍生字形保留 Magenta 字体许可与来源说明。
- **Draco 解码器**：保留 Apache-2.0；其他依赖保留各自 MIT 声明。
- **截图、分享图、Blender 工程和动画预览**：包含的模型、字体和画作仍适用各自权利，不作为整件 MIT 素材授权；含海报的截图也排除在项目 MIT 授权之外。

完整路径与条款对应关系见上方表格，署名和上游许可正文见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。未另行说明的模型或媒体不会因进入仓库而自动获得开放素材许可；这也不限制上游许可、法律或公有领域已经允许的使用。

### 再分发与贡献

再分发代码时保留 LICENSE 和相关第三方声明。网页发布包会携带许可证、范围说明、第三方声明及字体／解码器许可；这些说明不补授尚未获得的第三方权利。

原创代码与文档贡献按 MIT 接收；媒体贡献需单列可再分发的许可，详见[贡献指南](https://github.com/xiaoiver/strange-loops/blob/main/CONTRIBUTING.md)。本项目不授予 GEB 原书、埃舍尔原画或第三方名称与商标的权利。
