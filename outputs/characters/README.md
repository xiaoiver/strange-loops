# 阿基里斯与乌龟：Blender 角色原型

本工程为《集异璧》叙事展制作原创的黑白灰角色，不含外部模型或图像。当前是用于验证比例、站位和交互的简化造型。

## 文件

- `geb-companions.blend`：两个带骨骼和权重的角色、材质、摄影棚灯光与相机。
- `companions-preview.png`：Blender Cycles 渲染预览。
- `create_characters.py`：可复现的建模、绑定、动画和导出脚本。
- 网页模型位于 `../strange-loop/assets/characters/achilles.glb` 和 `tortoise.glb`，经 Draco 压缩后合计约 220 KB（解码器在 `../strange-loop/assets/draco/`）。从 Blender 重新导出后，在 `../strange-loop` 运行 `npm run compress-characters`。

## 动作

每位角色各有 `Idle`、`Walk`、`Look` 三个烘焙动画。网页的行走路线独立控制，动画片段保持原地动作，避免重复位移。

Blender 时间轴默认显示 1–31 帧的步行循环，鼠标放在三维视图内按空格可预览。打开覆盖显示可查看骨骼。其他动作保存在对应骨架的 Action 中。

阿基里斯高约 2.5 个 Blender 单位，乌龟高约 0.72；网页中分别以 0.60 和 0.46 的比例放入展厅。角色采用简化的分段蒙皮，后续可以在本文件中精修接缝与步态。

## 网页行为

角色载入后沿雕塑旁的两条短路线走动，再停下观察。点击角色可触发原创对白；切换 G／E／B 时会转身望向投影。支持键盘焦点与中英文标签。系统开启减弱动态时，直接显示停留姿态。

待机动画持续循环：阿基里斯约 14 秒一段，包含呼吸、上身轻移和间歇转头，双脚保持落地；乌龟约 18 秒一段，包含探头、侧望和轻动前肢。两个角色错开动作节奏，交谈或望向投影后自然返回待机。

角色使用场景 PBR 灯光和 GTAO。为保持字母阴影清晰，仅向 B 光源对应的地面投影，不向两面墙叠加角色剪影。角色自身关闭实时阴影接收，以避免小尺寸蒙皮模型上的阴影噪点；环境光和 AO 保留。

## 重建

在项目根目录运行：

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python outputs/characters/create_characters.py
```

脚本重建本目录的工程、渲染预览及网页 GLB 模型。桌面端当前打开的工程不会自动刷新，重建后需重新打开文件。
