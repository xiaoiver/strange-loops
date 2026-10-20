# 阿基里斯与乌龟：Blender 角色原型

本工程为《集异璧》叙事展制作原创的黑白灰角色，不含外部模型或图像。当前是用于验证比例、站位和交互的简化造型。

## 文件

- `geb-companions-lowpoly.blend`：当前低模乌龟版本，保留两位角色的骨骼、材质、动作、摄影棚灯光与相机。
- `geb-companions.blend`：原始圆滑乌龟版本，作为可编辑备份保留。
- `tortoise-lowpoly-preview.png`：低模乌龟的 Blender Cycles 近景预览。
- `lowpoly_tortoise.py`：可复现的低模网格构建器，可替换既有 Tortoise 骨架的网格。
- `tortoise-lowpoly.json`：面数、顶点数及骨架统计。
- `companions-preview.png`：Blender Cycles 渲染预览。
- `create_characters.py`：可复现的建模、绑定、动画和导出脚本。
- 网页模型位于 `../strange-loop/assets/characters/achilles.glb` 和 `tortoise.glb`，乌龟为 290 个三角面、175 个源顶点，所有面采用平面法线；原网格约 12,824 个三角面。乌龟 GLB 约 70 KB，保留三套动画。生成脚本直接使用 Blender 自带的 Draco 编码器，解码器位于 `../strange-loop/assets/draco/`。

## 动作

每位角色各有 `Idle`、`Walk`、`Look` 三个烘焙动画。网页的行走路线独立控制，动画片段保持原地动作，避免重复位移。

Blender 时间轴默认显示 1–31 帧的步行循环，鼠标放在三维视图内按空格可预览。打开覆盖显示可查看骨骼。其他动作保存在对应骨架的 Action 中。

阿基里斯高约 2.5 个 Blender 单位，乌龟高约 0.72；网页中分别以 0.60 和 0.46 的比例放入展厅。角色采用简化的分段蒙皮，后续可以在本文件中精修接缝与步态。

## 网页行为

角色载入后沿雕塑旁的两条短路线走动，再停下观察。点击角色可触发原创对白；切换 G／E／B 时会转身望向投影。支持键盘焦点与中英文标签。系统开启减弱动态时，直接显示停留姿态。

待机动画持续循环：阿基里斯约 14 秒一段，包含呼吸、上身轻移和间歇转头，双脚保持落地；乌龟约 18 秒一段，包含探头、侧望和轻动前肢。两个角色错开动作节奏，交谈或望向投影后自然返回待机。

角色使用场景 PBR 灯光和 GTAO。序厅仅向地面投影，关闭自身实时阴影接收以保持字母投影清晰。花园接收建筑遮挡的真实天光阴影，两位角色站在规则桌右后方的阴影中，返回序厅恢复原来的受光设置。

低模乌龟去掉了壳面刻线、圆滑边圈、细脚趾和喙线，用大块三角切面、简化的多面体头部和短腿表现体积。保持原来的七根骨骼、动作名称与网页 0.46 比例。

## 重建

在项目根目录运行：

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python outputs/characters/create_characters.py
```

脚本重建 `geb-companions-lowpoly.blend`、双人渲染预览及网页 GLB 模型，原始 `geb-companions.blend` 保留。桌面端当前打开的工程不会自动刷新，重建后需重新打开文件。
