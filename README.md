# 怪圈 · Strange Loops

简体中文 | [English](README.en.md)

以《哥德尔、艾舍尔、巴赫：集异璧之大成》为灵感的中英文可交互叙事展。当前完成序厅原型：一件三维雕塑，由场景光源在两面墙和地面投射 G、E、B，阿基里斯与乌龟在旁漫游、停留并与你交谈。

序厅使用 Three.js PBR 材质、PCSS 柔光阴影与 GTAO，支持拖动观察、三种字母视角、光源开关、自定义三字母雕塑生成（`?s=XYZ`）、当前雕塑 STL / OBJ 本地下载、中英文切换和角色待机骨骼动画。文案与角色模型均为原创致敬。

![序厅实机截图：GEB 雕塑、墙面投影与阿基里斯和乌龟](outputs/strange-loop/docs/screenshots/vestibule.jpg)

## 本地预览

仓库已包含构建后的网页与模型，无需安装依赖即可预览：

```sh
cd outputs/strange-loop
python3 -m http.server 4173
```

打开 <http://localhost:4173>。需要 HTTP 服务，不能直接双击 HTML。

## 修改与构建

```sh
cd outputs/strange-loop
npm ci
npm run build
npm start
```

网页是静态页面，发布目录为 `outputs/strange-loop`。详细渲染、交互和文案说明见[网页 README](outputs/strange-loop/README.md)。

## 项目结构

- `outputs/strange-loop/`：网页源码、锁定依赖版本、构建脚本、已构建 JavaScript、雕塑及角色 GLB。
- `outputs/characters/`：Blender 可编辑工程、建模与动画生成脚本、渲染预览及[角色说明](outputs/characters/README.md)。
- `PRODUCT.md`、`DESIGN.md`：产品方向与已确认的设计规范。

Blender 角色工程包含骨骼、材质及 Idle / Walk / Look 动画。重建命令见角色说明。

## 当前范围

目前仅序厅可完整体验，七章地图和 WU / MU 花园入口用于预告后续叙事，正文及章节交互尚未实现。项目未包含原书全文、封面扫描或艾舍尔作品图像。依赖及字体声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
