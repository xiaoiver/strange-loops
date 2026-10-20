"""Optimize the supplied Tripo mesh and bind it to the existing companion rig.
Run with Blender --background geb-companions-lowpoly.blend --python this_file.
The source upload and original prototype remain untouched.
"""
import bpy, bmesh, json, math
from pathlib import Path
from mathutils import Vector, Matrix

OUT=Path(__file__).resolve().parent
ASSET=OUT.parent/'strange-loop/assets/characters/tortoise.glb'
arm=bpy.data.objects['Tortoise']
assert arm.type=='ARMATURE'
original_matrix=arm.matrix_world.copy()
old_meshes=[o for o in arm.children if o.type=='MESH']
bpy.ops.import_scene.gltf(filepath=str(OUT/'source/tripo-tortoise.glb'))
imported=[o for o in bpy.context.selected_objects if o.type=='MESH']
assert len(imported)==1
obj=imported[0]
bpy.context.view_layer.objects.active=obj
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
source_triangles=sum(len(p.vertices)-2 for p in obj.data.polygons)
bm=bmesh.new();bm.from_mesh(obj.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.000001)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
bmesh.ops.dissolve_limit(bm,angle_limit=math.radians(4),use_dissolve_boundaries=False,
    verts=list(bm.verts),edges=list(bm.edges),delimit={'MATERIAL'})
bm.to_mesh(obj.data);bm.free();obj.data.update()
triangles=lambda:sum(len(p.vertices)-2 for p in obj.data.polygons)
if triangles()>600:
    mod=obj.modifiers.new('Web silhouette reduction','DECIMATE')
    mod.ratio=600/triangles();mod.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=mod.name)

lo=Vector(tuple(min(v.co[i] for v in obj.data.vertices) for i in range(3)))
hi=Vector(tuple(max(v.co[i] for v in obj.data.vertices) for i in range(3)))
scale=.69/(hi.z-lo.z)
center_x=(lo.x+hi.x)/2
for vertex in obj.data.vertices:
    vertex.co=Vector(((vertex.co.x-center_x)*scale,vertex.co.y*scale-.10,(vertex.co.z-lo.z)*scale))
# Keep the supplied faceted silhouette crisp instead of interpolating normals
# across the generated shell panels.
for face in obj.data.polygons:face.use_smooth=False
obj.data.materials.clear()
material=bpy.data.materials.new('Tripo tortoise | matte graphite')
material.use_nodes=True;material.diffuse_color=(.25,.26,.25,1);material.use_backface_culling=True
bsdf=material.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value=(.25,.26,.25,1)
bsdf.inputs['Roughness'].default_value=.84;bsdf.inputs['Metallic'].default_value=0
obj.data.materials.append(material)

def smooth(a,b,value):
    t=max(0,min(1,(value-a)/(b-a)))
    return t*t*(3-2*t)
groups={bone.name:obj.vertex_groups.new(name=bone.name) for bone in arm.data.bones}
counts={name:0 for name in groups}
for vertex in obj.data.vertices:
    x,y,z=vertex.co
    head=smooth(.37,.52,-y)*(1-smooth(.22,.32,abs(x)))*(1-smooth(.48,.54,z))
    leg=(1-smooth(.16,.28,z))*smooth(.14,.27,abs(x))*smooth(.10,.22,abs(y))*(1-head)
    leg_name=f"Leg_{'Front' if y<0 else 'Back'}_{'L' if x<0 else 'R'}"
    remaining=1-head-leg
    shell=remaining*smooth(.24,.38,z)
    weights={'Head':head,leg_name:leg,'Shell':shell,'Root':remaining-shell}
    assert abs(sum(weights.values())-1)<1e-5
    for name,weight in weights.items():
        if weight>.00001:groups[name].add([vertex.index],weight,'REPLACE');counts[name]+=1
assert all(counts[name]>0 for name in groups),counts
for old in old_meshes:bpy.data.objects.remove(old,do_unlink=True)
obj.name='Tortoise | optimized Tripo skinned sculpture'
obj.parent=arm;obj.matrix_parent_inverse=Matrix.Identity(4)
modifier=obj.modifiers.new('Articulation','ARMATURE');modifier.object=arm
# Gentle movement keeps the shell stable on this continuous generated surface.
actions=[a for a in bpy.data.actions if a.name.startswith('Tortoise_')]
for action in actions:
    curves=[curve for layer in action.layers for strip in layer.strips for bag in strip.channelbags for curve in bag.fcurves]
    for curve in curves:
        factor=.45 if 'bones["Head"]' in curve.data_path else .75 if 'bones["Leg_' in curve.data_path else .4 if 'bones["Shell"]' in curve.data_path else 1
        if factor!=1:
            for key in curve.keyframe_points:
                key.co.y*=factor;key.handle_left.y*=factor;key.handle_right.y*=factor
scene=bpy.context.scene
arm.animation_data.action=next(a for a in actions if a.name.endswith('_Idle'))
scene.frame_set(1)
arm.matrix_world=Matrix.Identity(4);bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);obj.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(ASSET),export_format='GLB',use_selection=True,
    export_animations=True,export_animation_mode='ACTIONS',export_anim_single_armature=False,
    export_materials='EXPORT',export_cameras=False,export_lights=False,export_force_sampling=True,
    export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
arm.matrix_world=original_matrix;bpy.context.view_layer.update()
report={'source':'source/tripo-tortoise.glb','generator':'Tripo','source_triangles':source_triangles,
    'optimized_triangles':triangles(),'vertices':len(obj.data.vertices),'glb_bytes':ASSET.stat().st_size,
    'height':.69,'scale_in_web':.46,'shading':'flat','weighted_vertices':counts,
    'animations':[a.name for a in actions]}
(OUT/'tripo-tortoise-optimization.json').write_text(json.dumps(report,indent=2))
target=arm.matrix_world@Vector((0,-.10,.34));cam=scene.camera
cam.location=target+Vector((2.6,-3.6,2.0));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=2.05
scene.render.resolution_x=1400;scene.render.resolution_y=1050;scene.render.resolution_percentage=100;scene.cycles.samples=48
bpy.data.objects['Achilles'].hide_render=True
for child in bpy.data.objects['Achilles'].children:child.hide_render=True
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'geb-companions-tripo.blend'))
scene.render.filepath=str(OUT/'tripo-tortoise-preview.png');bpy.ops.render.render(write_still=True)
print('TRIPO_TORTOISE_READY',report)
