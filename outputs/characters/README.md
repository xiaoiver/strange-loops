# 阿基里斯与乌龟：Blender 角色

《集异璧》叙事展的黑白灰同行者。阿基里斯来自用户提供的 POLLO28 人偶模型（CC BY 4.0），乌龟由用户使用 **Tripo 生成**并提供原始 GLB。本项目完成减面、材质统一、骨架清理及动画适配；原文件和旧原型均保留。

## 当前文件

- `geb-companions-mannequin.blend`：当前双人可编辑工程，包含人偶、低模乌龟、骨架、材质、三套动作与摄影棚。默认显示 Idle 第一帧。
- `optimize_mannequin.py`、`mannequin-optimization.json`、`mannequin-preview.png`：人偶优化与动作适配脚本、统计和 Cycles 双人预览。
- `source/pollo28-mannequin.glb`：未修改的人偶原文件，保留作者与许可元数据。
- `source/achilles-prototype-animated.glb`：替换前的本地建模角色备份。
- `geb-companions-tripo.blend`：乌龟替换完成时的工程，作为当前人偶优化脚本的输入；其中仍是旧阿基里斯。
- `optimize_tripo_tortoise.py`：读取用户模型并优化、绑定、导出和渲染的可复现脚本。
- `source/tripo-tortoise.glb`：用户提供的原始生成文件，未修改。
- `source/tortoise-prototype-animated.glb`：替换前的 290 面动画原型备份。
- `tripo-tortoise-preview.png`：当前乌龟的 Blender Cycles 近景。
- `tripo-tortoise-optimization.json`：面数、顶点数、文件大小和绑定统计。
- 网页 GLB 位于 `../strange-loop/assets/characters/achilles.glb` 和 `tortoise.glb`。

用户模型原有 15,515 个三角面、约 518 KB，无骨骼、动画或贴图。清理焊接与退化面后简化为 598 个三角面、309 个源顶点，保持壳、头和短腿的轮廓，采用平面法线。灰色哑光 PBR 材质粗糙度为 0.84，金属度为 0。最终 GLB 约 85 KB，包含七根骨骼和三套烘焙动画，使用 Blender 内置 Draco 编码器；网页解码器位于 `../strange-loop/assets/draco/`。

## 人偶来源与优化

[STYLE Fortnite-creative-mannequin](https://sketchfab.com/3d-models/style-fortnite-creative-mannequin-5da12762b03a40078e21e51a1e185e8c) by [POLLO28](https://sketchfab.com/POLLO28)，[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。原始 GLB 约 2.30 MB，包含 89 根骨骼、9,324 面主体与一个极小辅助网格。当前移除无用对象和辅助骨骼，主体保留 5,000 面、3,704 个源顶点和 73 根骨骼；继续使用原蒙皮，限制每顶点最多四个权重并重新归一化。材质改为浅灰哑光 PBR，粗糙度 0.82、金属度 0。

保留原抱臂姿态并重新制作安静的 Idle、原地 Walk 和 Look；行走使用放松下垂的双臂，逐帧校正最低支撑足的高度。删除动画中重复的常量关键帧，再用 Draco 压缩网格，最终 GLB 约 241 KB（含完整三套动作）。作者、来源、许可与修改说明保存在 GLB extras、网页的中英文章节地图和 THIRD_PARTY_NOTICES.md。

## 动作与比例

每位角色有 `Idle`、`Walk`、`Look` 三套动画。网页单独控制行走路线，片段为原地动作，避免重复位移。新乌龟用空间权重绑定到现有骨架，龟壳、头和四肢分别控制；头部与四肢动作幅度适当降低，避免连续生成网格在接缝处过度拉伸。

当前工程默认显示 Idle 的第一帧。各动作保存在骨架的 Action 中，可切换后播放。阿基里斯高约 2.5 个 Blender 单位，乌龟高 0.69；网页分别以 0.60 和 0.46 的比例放入展厅，沿用既有站位和路线。

待机动画错开节奏：阿基里斯约 14 秒，抱臂呼吸、上身轻移和间歇转头；乌龟约 18 秒，包含探头、侧望和轻动前肢。交谈或望向投影后返回待机。系统开启减弱动态时直接显示停留姿态。

角色使用场景 PBR 灯光和 GTAO。序厅向地面投影，关闭自身实时阴影接收以保持字母投影清晰；花园接收建筑遮挡的天光阴影，两位角色站在规则桌右后方的阴影中。

## 重建当前角色

在项目根目录运行人偶优化，输入为已保存的新乌龟工程：

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background outputs/characters/geb-companions-tripo.blend \
  --python outputs/characters/optimize_mannequin.py
```

脚本更新人偶 GLB、当前双人工程、统计和预览，不改变乌龟 GLB。

### 重新优化乌龟

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

以下命令重建历史原型并会覆盖网页模型；随后依次运行乌龟和人偶优化命令可恢复当前两位角色：

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python outputs/characters/create_characters.py
```
