# 阿基里斯与乌龟：Blender 角色

《集异璧》叙事展的黑白灰同行者。阿基里斯来自用户提供的 POLLO28 人偶模型（CC BY 4.0），乌龟由用户使用 **Tripo 生成**并提供原始 GLB。本项目完成减面、材质统一、骨架清理及动画适配；原文件和旧原型均保留。

## 当前文件

- `geb-companions-jog.blend`：当前双人可编辑工程，包含人偶、低模乌龟、骨架、材质、四套人物动作、三套乌龟动作与摄影棚。默认显示 Idle 第一帧。
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

保留原抱臂 Idle 和 Look；Walk 使用 Quaternius Universal Animation Library Standard 的 `Walk_Formal_Loop`（CC0），在 Blender 中校准 T／A 静止姿态并转到现有骨架，按腿长缩放位移，适配鞋底接触，去掉根骨骼前进位移。网页继续独立控制路线。Draco 压缩后的 GLB 约 340 KB，含完整四套人物动作。作者、来源、许可与修改说明保存在 GLB extras、网页的中英文章节地图和 THIRD_PARTY_NOTICES.md。

## 动作与比例

阿基里斯有 `Idle`、`Walk`、`Jog`、`Look` 四套动画，乌龟有 `Idle`、`Walk`、`Look` 三套动画。网页单独控制行走路线，片段为原地动作，避免重复位移。新乌龟用空间权重绑定到现有骨架，龟壳、头和四肢分别控制；头部与四肢动作幅度适当降低，避免连续生成网格在接缝处过度拉伸。

当前工程默认显示 Idle 的第一帧。各动作保存在骨架的 Action 中，可切换后播放。阿基里斯高约 2.5 个 Blender 单位，乌龟高 0.69；网页分别以 0.60 和 0.46 的比例放入展厅，序厅沿用既有站位，序厅与第一章往返保持站位、仅转向；画廊行走时长由路线距离和各自步速计算。

待机动画错开节奏：阿基里斯约 14 秒，抱臂呼吸、上身轻移和间歇转头；乌龟约 18 秒，包含探头、侧望和轻动前肢。交谈或望向投影后返回待机。系统开启减弱动态时直接显示停留姿态。

角色使用场景 PBR 灯光和 GTAO。序厅向地面投影，关闭自身实时阴影接收以保持字母投影清晰；花园接收建筑遮挡的天光阴影，两位角色站在规则桌右后方的阴影中。

## 重建当前角色

在项目根目录运行人偶优化，输入为已保存的新乌龟工程：

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background outputs/characters/geb-companions-tripo.blend \
  --python outputs/characters/optimize_mannequin.py
```

当前动作重定向直接使用已保留的上一版人偶工程与提取后的 CC0 动作源：

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background outputs/characters/geb-companions-walk.blend \
  --python outputs/characters/retarget_ual_walk.py
```

此步骤保留 `geb-companions-walk.blend`，另存 `geb-companions-ual.blend`，更新网页人偶 GLB 及 `mannequin-walk.json`，不改变乌龟 GLB。`mannequin-ual-walk-preview.gif` 为当前动作的 Blender 渲染预览。旧版程序生成慢走和脚本仍保留，供回退使用。

动作源为 Quaternius 的 [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html)，许可为 CC0。用户提供的 Standard 压缩包包含原地和 `_RM` 带位移两套动画；本项目仅保留 `_RM` 中的 `Walk_Formal_Loop` 及参考模型为 `source/quaternius-walk-formal-loop.glb`，许可见 `source/quaternius-LICENSE.txt`。通过带位移动作取得原始每轮 1.30 的前进距离，再按腿长比约 1.485 转换为人偶每轮约 1.931、网页约 1.158 世界单位；循环为 1.333 秒。实际播放速度由路线位移决定，初次短距离入场也能完整切换到步行姿态。当前选用 Formal 版本，双臂摆动较小，上身更直立。

自动验证使用导出的实际骨骼动画，检查支撑脚尖位置、所有骨骼的循环接缝、根骨骼无额外位移、变速与等待时的动作时间。Blender 逐帧适配两脚实际蒙皮网格的离地高度，保留原动作的脚跟落地、脚尖蹬地和抬脚时序。

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

## 章节穿门慢跑

第一章到第二章的两段穿门路线使用 Quaternius `Jog_Fwd_Loop`（CC0），展品之间仍使用 `Walk_Formal_Loop`。人物过渡平均速度 2.50 世界单位／秒，乌龟继续用自己的步行动作、平均速度提高至 2.00；其步频只在穿门期间提高，普通漫游恢复原速。序厅与第一章往返仍只转向。

在 Formal 工程上添加慢跑并导出四动作 GLB：

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background outputs/characters/geb-companions-ual.blend \
  --python outputs/characters/retarget_ual_walk.py -- --clip Jog_Fwd_Loop
```

另存 `geb-companions-jog.blend`，原 Formal 工程保留。Jog 动作源为 `source/quaternius-jog-fwd-loop.glb`；源片段循环 0.933 秒、根位移 5.0 单位，本项目将前后步幅收至 30%、离地高度至 65%，适配轻慢跑。按腿长比缩放，并按实际脚尖支撑段校准步幅后，每轮模型 2.87224、网页 1.72335 世界单位，网页按实际位移推进动作，起停平滑混合 Idle。参数与接触检查见 `mannequin-jog.json`，近景预览为 `mannequin-ual-jog-preview.gif`（Blender 渲染）。

慢跑重定向修正：先在源腿轴上提取膝盖弯曲方向，再投影到缩短步幅后的目标腿，防止膝盖反折。脚部在统一解剖坐标中限制俯仰至 −30°～75°、侧倾至 ±12°，保留转向。网页测试以每个关键帧间 8 个采样点检查膝盖、脚底、脚尖方向，并覆盖与 Idle 的五种混合权重。
