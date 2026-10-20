"""Adapt POLLO28's CC-BY-4.0 mannequin to the Achilles companion.
Run in Blender with geb-companions-tripo.blend as input. Source is preserved.
"""
import bpy, math, json, struct
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion

OUT=Path(__file__).resolve().parent
SOURCE=OUT/'source/pollo28-mannequin.glb'
ASSET=OUT.parent/'strange-loop/assets/characters/achilles.glb'
old=bpy.data.objects['Achilles'];studio_matrix=old.matrix_world.copy()
for child in list(old.children):bpy.data.objects.remove(child,do_unlink=True)
bpy.data.objects.remove(old,do_unlink=True)
for action in list(bpy.data.actions):
    if action.name.startswith('Achilles_'):bpy.data.actions.remove(action)
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
added=set(bpy.data.objects)-before
arm=next(o for o in added if o.type=='ARMATURE');source_bones=len(arm.data.bones)
obj=max((o for o in added if o.type=='MESH'),key=lambda o:len(o.data.polygons))
scene=bpy.context.scene;scene.render.fps=30
scene.frame_set(0);bpy.context.view_layer.update()
fold={p.name:p.matrix_basis.copy() for p in arm.pose.bones}
source_action=arm.animation_data.action if arm.animation_data else None
arm.animation_data_clear()
if source_action:bpy.data.actions.remove(source_action)
source_triangles=sum(len(p.vertices)-2 for p in obj.data.polygons)
mesh_world=obj.matrix_world.copy();arm_world=arm.matrix_world.copy()
# Normalize the rest surface to the existing 2.5-unit character envelope.
points=[mesh_world@v.co for v in obj.data.vertices]
lo=Vector(tuple(min(v[i] for v in points) for i in range(3)))
hi=Vector(tuple(max(v[i] for v in points) for i in range(3)))
factor=2.5/(hi.z-lo.z)
normalization=Matrix.Scale(factor,4)@Matrix.Translation(Vector((-(hi.x+lo.x)/2,0,-lo.z)))
arm.parent=None;arm.matrix_world=Matrix.Identity(4);arm.data.transform(normalization@arm_world)
obj.parent=None;obj.matrix_world=Matrix.Identity(4);obj.data.transform(normalization@mesh_world)
obj.parent=arm;obj.matrix_parent_inverse=Matrix.Identity(4)
for other in added-{arm,obj}:bpy.data.objects.remove(other,do_unlink=True)
arm.name='Achilles';obj.name='Achilles | POLLO28 mannequin adapted for GEB'
for p in arm.pose.bones:p.rotation_mode='QUATERNION';p.matrix_basis=Matrix.Identity(4)
arm.data.pose_position='POSE';bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
# Keep the professionally weighted surface; only reduce its web silhouette budget.
mod=obj.modifiers.new('Web silhouette reduction','DECIMATE');mod.ratio=5000/source_triangles;mod.use_collapse_triangulate=True
bpy.ops.object.modifier_move_up(modifier=mod.name)
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.ops.object.vertex_group_limit_total(limit=4)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
weighted={obj.vertex_groups[g.group].name for v in obj.data.vertices for g in v.groups if g.weight>1e-6}
keep=set(weighted)
for name in list(weighted):
    bone=arm.data.bones.get(name)
    while bone:
        keep.add(bone.name);bone=bone.parent
bpy.context.view_layer.objects.active=arm;obj.select_set(False);arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for bone in list(arm.data.edit_bones):
    if bone.name not in keep:arm.data.edit_bones.remove(bone)
bpy.ops.object.mode_set(mode='OBJECT')
for bone in arm.data.bones:bone.use_deform=True
material=bpy.data.materials.new('Achilles | matte pale graphite');material.use_nodes=True
material.diffuse_color=(.48,.49,.48,1);material.use_backface_culling=True
bsdf=material.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(.48,.49,.48,1);bsdf.inputs['Roughness'].default_value=.82;bsdf.inputs['Metallic'].default_value=0
obj.data.materials.clear();obj.data.materials.append(material)
for polygon in obj.data.polygons:polygon.material_index=0
arm['model_title']='STYLE Fortnite-creative-mannequin'
arm['model_author']='POLLO28'
arm['model_source']='https://sketchfab.com/3d-models/style-fortnite-creative-mannequin-5da12762b03a40078e21e51a1e185e8c'
arm['model_license']='CC-BY-4.0 https://creativecommons.org/licenses/by/4.0/'
arm['adaptations']='Mesh reduction, grayscale PBR material, normalization, animation adaptation.'

def bone(prefix):
    matches=[p for p in arm.pose.bones if p.name.startswith(prefix+'_')]
    assert len(matches)==1,(prefix,[p.name for p in matches])
    return matches[0]

def capture():return {p.name:p.matrix_basis.copy() for p in arm.pose.bones}
def restore(base):
    for p in arm.pose.bones:p.matrix_basis=base[p.name].copy()
    bpy.context.view_layer.update()
# Retain the supplied contemplative folded-arm stance for idle and conversation.
for p in arm.pose.bones:
    matrix=fold[p.name].copy();matrix.translation*=factor;p.matrix_basis=matrix
bpy.context.view_layer.update();folded=capture()
# Relax the A-pose for walking, without disturbing the original skin weights.
for p in arm.pose.bones:p.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
def aim_segment(joint,child,direction):
    p=bone(joint);end=bone(child)
    current=end.head-p.head;delta=current.rotation_difference(Vector(direction))
    head=p.head.copy();p.matrix=Matrix.Translation(head)@delta.to_matrix().to_4x4()@Matrix.Translation(-head)@p.matrix
    bpy.context.view_layer.update()
for side,sign in [('l',1),('r',-1)]:
    aim_segment('upperarm_'+side,'lowerarm_'+side,(sign*.055,0,-.39))
    aim_segment('lowerarm_'+side,'hand_'+side,(sign*.015,-.045,-.34))
neutral=capture()
root=next(p for p in arm.pose.bones if p.parent is None)

def rotate_world(prefix,axis,angle):
    p=bone(prefix);local=p.matrix.to_3x3().inverted()@Vector(axis)
    p.rotation_quaternion=p.rotation_quaternion@Quaternion(local.normalized(),angle)
    bpy.context.view_layer.update()
def gesture(t,start,end):return math.sin(math.pi*(t-start)/(end-start))**2 if start<t<end else 0

def ground():
    # Keep the lowest support foot on the floor in every baked sample.
    bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();evaluated=obj.evaluated_get(deps);mesh=evaluated.to_mesh()
    z=min(v.co.z for v in mesh.vertices);evaluated.to_mesh_clear()
    root.location+=root.bone.matrix_local.to_3x3().inverted()@Vector((0,0,-z))
    bpy.context.view_layer.update()

arm.animation_data_create();actions={}
for clip,end,step in [('Idle',421,3),('Walk',31,1),('Look',61,3)]:
    action=bpy.data.actions.new('Achilles_'+clip);action.use_fake_user=True;arm.animation_data.action=action
    for frame in range(1,end+1,step):
        scene.frame_set(frame);restore(neutral if clip=='Walk' else folded)
        t=(frame-1)/(end-1);phase=math.tau*t
        if clip=='Walk':
            for side,offset in [('l',0),('r',math.pi)]:
                q=phase+offset
                rotate_world('thigh_'+side,(1,0,0),.26*math.sin(q))
                rotate_world('calf_'+side,(1,0,0),.42*max(0,-math.sin(q)))
                rotate_world('foot_'+side,(1,0,0),-.1*math.sin(q))
                rotate_world('upperarm_'+side,(1,0,0),-.16*math.sin(q))
                rotate_world('lowerarm_'+side,(1,0,0),-.055-.035*math.sin(q))
            rotate_world('spine_03',(0,0,1),.015*math.sin(phase))
        elif clip=='Look':
            g=math.sin(math.pi*t)**2
            rotate_world('neck_01',(0,0,1),.05*g)
            rotate_world('head',(0,0,1),.38*g)
            rotate_world('head',(1,0,0),-.075*g)
        else:
            rotate_world('spine_03',(1,0,0),.009*math.sin(phase*3))
            rotate_world('spine_05',(0,1,0),.006*math.sin(phase))
            rotate_world('head',(0,0,1),.16*gesture(t,.28,.49)-.10*gesture(t,.71,.91))
            rotate_world('head',(1,0,0),-.035*gesture(t,.28,.49))
        ground()
        for p in arm.pose.bones:
            p.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=p.name)
            p.keyframe_insert(data_path='location',frame=frame,group=p.name)
            p.keyframe_insert(data_path='scale',frame=frame,group=p.name)
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:key.interpolation='LINEAR'
                    values=[key.co.y for key in curve.keyframe_points]
                    if max(values)-min(values)<1e-6:
                        for key in list(curve.keyframe_points)[1:-1][::-1]:curve.keyframe_points.remove(key,fast=True)
                        curve.update()
    track=arm.animation_data.nla_tracks.new();track.name=clip
    track.strips.new(action.name,1,action);track.mute=True
    actions[clip]=action
arm.animation_data.action=actions['Idle'];scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);obj.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(ASSET),export_format='GLB',use_selection=True,
    export_animations=True,export_animation_mode='ACTIONS',export_anim_single_armature=False,
    export_force_sampling=False,export_materials='EXPORT',export_cameras=False,export_lights=False,
    export_extras=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
# Verify exported clips rather than reporting only Blender's in-memory actions.
data=ASSET.read_bytes();json_length=struct.unpack_from('<I',data,12)[0]
gltf=json.loads(data[20:20+json_length]);exported=[a['name'] for a in gltf.get('animations',[])]
assert set(exported)=={'Achilles_Idle','Achilles_Walk','Achilles_Look'},exported
triangles=sum(len(p.vertices)-2 for p in obj.data.polygons)
report={'source':'source/pollo28-mannequin.glb','author':'POLLO28','license':'CC-BY-4.0',
    'source_triangles':source_triangles,'source_bones':source_bones,'optimized_triangles':triangles,'vertices':len(obj.data.vertices),
    'bones':len(arm.data.bones),'glb_bytes':ASSET.stat().st_size,'height':2.5,'scale_in_web':.6,
    'animations':exported}
(OUT/'mannequin-optimization.json').write_text(json.dumps(report,indent=2))
# Restore the companion studio placement; the runtime GLB stays at identity.
arm.matrix_world=studio_matrix;arm.hide_render=False;obj.hide_render=False
for child in bpy.data.objects['Tortoise'].children:child.hide_render=False
bpy.data.objects['Tortoise'].hide_render=False
scene.frame_start=1;scene.frame_end=421;scene.frame_set(1)
cam=scene.camera;target=Vector((0,-.06,1.18));cam.location=target+Vector((3.3,-6.5,2.0));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=3.7
scene.render.resolution_x=1400;scene.render.resolution_y=1100;scene.render.resolution_percentage=100;scene.cycles.samples=32
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'geb-companions-mannequin.blend'))
scene.render.filepath=str(OUT/'mannequin-preview.png');bpy.ops.render.render(write_still=True)
print('MANNEQUIN_READY',report)
