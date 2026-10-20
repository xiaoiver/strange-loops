# 阿基里斯与乌龟：Blender 角色

《集异璧》叙事展的黑白灰同行者。阿基里斯为本地 Blender 原创建模；当前乌龟由用户提供的 Tripo 生成网格优化而来，本项目完成网格清理、减面、材质统一、绑定与动画适配。

## 当前文件

- `geb-companions-tripo.blend`：当前可编辑工程，包含两位角色、骨架、材质、动作与摄影棚。默认相机为乌龟近景，阿基里斯在渲染中隐藏但模型保留。
- `optimize_tripo_tortoise.py`：读取用户模型并优化、绑定、导出和渲染的可复现脚本。
- `source/tripo-tortoise.glb`：用户提供的原始生成文件，未修改。
- `source/tortoise-prototype-animated.glb`：替换前的 290 面动画原型备份。
- `tripo-tortoise-preview.png`：当前乌龟的 Blender Cycles 近景。
- `tripo-tortoise-optimization.json`：面数、顶点数、文件大小和绑定统计。
- 网页 GLB 位于 `../strange-loop/assets/characters/achilles.glb` 和 `tortoise.glb`。

用户模型原有 15,515 个三角面、约 518 KB，无骨骼、动画或贴图。清理焊接与退化面后简化为 598 个三角面、309 个源顶点，保持壳、头和短腿的轮廓，采用平面法线。灰色哑光 PBR 材质粗糙度为 0.84，金属度为 0。最终 GLB 约 85 KB，包含七根骨骼和三套烘焙动画，使用 Blender 内置 Draco 编码器；网页解码器位于 `../strange-loop/assets/draco/`。

## 动作与比例

每位角色有 `Idle`、`Walk`、`Look` 三套动画。网页单独控制行走路线，片段为原地动作，避免重复位移。新乌龟用空间权重绑定到现有骨架，龟壳、头和四肢分别控制；头部与四肢动作幅度适当降低，避免连续生成网格在接缝处过度拉伸。

当前工程默认显示 Idle 的第一帧。各动作保存在骨架的 Action 中，可切换后播放。阿基里斯高约 2.5 个 Blender 单位，乌龟高 0.69；网页分别以 0.60 和 0.46 的比例放入展厅，沿用既有站位和路线。

待机动画错开节奏：阿基里斯约 14 秒，包含呼吸、上身轻移和间歇转头；乌龟约 18 秒，包含探头、侧望和轻动前肢。交谈或望向投影后返回待机。系统开启减弱动态时直接显示停留姿态。

角色使用场景 PBR 灯光和 GTAO。序厅向地面投影，关闭自身实时阴影接收以保持字母投影清晰；花园接收建筑遮挡的天光阴影，两位角色站在规则桌右后方的阴影中。

## 重建当前乌龟

在项目根目录运行，保留已保存的原型骨架作为输入：

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background outputs/characters/geb-companions-lowpoly.blend \
  --python outputs/characters/optimize_tripo_tortoise.py
```

脚本更新当前乌龟 GLB、新工程、统计与近景，不修改源文件和旧工程。桌面端打开的工程不会自动刷新，需自行打开新文件。

## 历史原型

- `geb-companions.blend`：原始圆滑乌龟工程。
- `geb-companions-lowpoly.blend`、`lowpoly_tortoise.py`、`tortoise-lowpoly.json`、`tortoise-lowpoly-preview.png`：先前 290 面的本地建模原型。
- `create_characters.py`、`companions-preview.png`：最初的角色生成脚本与双人预览。

以下命令重建历史原型并会覆盖网页模型；随后运行上面的优化命令可恢复当前乌龟：

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python outputs/characters/create_characters.py
```
