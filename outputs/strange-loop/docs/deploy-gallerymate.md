# 发布到 Gallery Mate 官网

目标地址：`https://www.gallerymate.xyz/experiences/geb`。带尾斜杠的地址也可访问，由官网规范化；HTML 内的固定 base 保证资源始终从 `/experiences/geb/` 加载。

## 构建可审阅发布包

在干净、已提交的本仓库版本上执行：

```sh
cd outputs/strange-loop
npm ci
npm test
npm run release
```

输出为 `dist/experiences/geb/`：完整 HTML、CSS、JavaScript、雕塑二进制、两个人物、Draco 解码器、WOFF2 字体、分享截图、MIT 许可证、许可范围说明和第三方声明。不会复制源文件、Blender 工程、依赖目录或本地配置。

`release.json` 记录来源仓库、完整提交 SHA、工作区是否干净，以及每个文件的大小与 SHA-256。生成阶段校验字体字形覆盖和文件完整性；GM 导入时只接受干净、固定提交的包。GitHub 的 Verify website release 工作流会运行相同检查并上传发布包 artifact。

## 同步到官网

在 Gallery Mate 的独立功能分支执行：

```sh
cd marketing
node scripts/geb-release.mjs /absolute/path/to/strange-loops/outputs/strange-loop/dist/experiences/geb
node scripts/geb-release.mjs
```

这会校验后更新 `marketing/public/experiences/geb/`。发布快照跟随 GM 提交，代码主源仍在 strange-loops；更新展厅时重复构建和导入，再提交新的 GM PR。无需给 GM 的 Actions 增加跨私有仓库读取权限。

官网对该路径直接提供静态文档，不套用 React 页面、导航、主题或博客布局；官网页脚提供入口，网站地图包含语言链接。默认中文、`?lang=en` 为英文分享页，`?lang=zh` 指定中文。语言切换会更新当前 URL，保留自定义雕塑参数和片段；原有 `geb.garden.v1` 进度继续使用。

GM 的既有 ECS workflow 会打包 public 文件。打包前验证发布清单；启动实际 standalone 发布包后，逐一检查中英文入口、全部资源字节、字体／WASM MIME 类型以及缺失资源的 404。官网原有页面和认证检查继续执行。合并 GM PR 后由既有官网 workflow 发布；本仓库 CI 仅构建 artifact，不直接操作生产服务器。

## 字体

字体改为自行托管的 Noto Serif SC 子集，派生字体名为 Strange Loops Serif SC，保留 400–700 字重与原来的展厅排版，不再依赖 Google Fonts 的运行时请求。字体授权在 `assets/fonts/OFL.txt`，固定上游版本与 SHA-256 在 `assets/fonts/subset.json`。

新增中文文案后，若发布检查发现缺字，请按 `scripts/subset-font.py` 的说明从固定 SHA-256 的原始字体重建子集，然后提交字体与清单。不要简单跳过字形检查。

## 回滚

跟随 GM 的发布包回滚，或在 GM 中恢复上一份 `public/experiences/geb` 快照重新发布。展厅的存档在访客浏览器中；换域名会使用不同的浏览器存储，但同域、同路径的版本更新保留原有进度。


### Seven-language release

The release now includes `index.html` (Chinese), `en.html`, `ja.html`, `ko.html`, `fr.html`, `de.html`, and `es.html`. All pages declare the full set of language alternates. On the Gallery Mate side, extend the existing language-to-file routing and `gebHref` helper to these seven codes when syncing this release; the prior integration only distinguished Chinese and English. The client-side picker already resolves all seven languages, but correct initial metadata requires the server to select the matching HTML file. Keep query parameters such as `s` intact. Update route/sitemap tests and smoke-test each `?lang=` URL as part of that integration.
