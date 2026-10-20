"""Original faceted tortoise mesh, compatible with the existing Tortoise rig."""
import bpy, bmesh, math, json
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent

def create_lowpoly_tortoise(arm):
    parts=[]
    def material(name,color):
        mat=bpy.data.materials.get(name) or bpy.data.materials.new(name)
        mat.use_nodes=True;mat.diffuse_color=(*color,1)
        node=mat.node_tree.nodes.get('Principled BSDF')
        node.inputs['Base Color'].default_value=(*color,1)
        node.inputs['Roughness'].default_value=.86
        return mat
    shell=material('Lowpoly | graphite shell',(.22,.235,.225))
    body=material('Lowpoly | graphite body',(.29,.30,.29))
    eye=material('Lowpoly | eyes',(.035,.038,.036))
    def finish(obj,name,mat,bone):
        obj.name=name
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
        bpy.context.view_layer.objects.active=obj
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
        for polygon in obj.data.polygons:polygon.use_smooth=False
        obj.data.materials.append(mat)
        group=obj.vertex_groups.new(name=bone);group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
        parts.append(obj);return obj
    def ico(name,location,scale,mat,bone):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=location)
        obj=bpy.context.object;obj.scale=scale
        return finish(obj,name,mat,bone)
    def cone(name,a,b,r1,r2,bone,segments=6):
        a,b=Vector(a),Vector(b);axis=b-a
        bpy.ops.mesh.primitive_cone_add(vertices=segments,radius1=r1,radius2=r2,depth=axis.length,location=(a+b)/2)
        obj=bpy.context.object;obj.rotation_euler=axis.to_track_quat('Z','Y').to_euler()
        return finish(obj,name,body,bone)
    ico('Lowpoly body',(0,0,.27),(.45,.56,.14),body,'Root')
    vertices=[]
    for count,rx,ry,z in [(10,.55,.70,.25),(10,.46,.585,.52),(5,.24,.305,.69)]:
        vertices.extend((rx*math.cos(i*math.tau/count),ry*math.sin(i*math.tau/count),z) for i in range(count))
    faces=[]
    for i in range(10):
        j=(i+1)%10
        faces.extend([(i,j,10+i),(j,10+j,10+i)])
    for i in range(5):
        a,b,c=10+2*i,10+(2*i+1)%10,10+(2*i+2)%10
        d,e=20+i,20+(i+1)%5
        faces.extend([(a,b,d),(b,e,d),(b,c,e)])
    faces.extend([tuple(reversed(range(10))),tuple(range(20,25))])
    mesh=bpy.data.meshes.new('Lowpoly carapace');mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new('Lowpoly carapace',mesh);bpy.context.collection.objects.link(obj)
    finish(obj,'Lowpoly carapace',shell,'Shell')
    cone('Lowpoly neck',(0,-.48,.30),(0,-.85,.36),.10,.105,'Head')
    ico('Lowpoly head',(0,-.90,.365),(.165,.205,.145),body,'Head')
    for sign in [-1,1]:
        ico('Lowpoly eye',(sign*.125,-.994,.425),(.013,.015,.014),eye,'Head')
    for side,x in [('L',-.38),('R',.38)]:
        for end,y in [('Front',-.42),('Back',.43)]:
            cone('Lowpoly leg',(x*1.22,y*1.24,.075),(x,y,.28),.10,.095,f'Leg_{end}_{side}',5)
            cone('Lowpoly foot',(x*1.22,y*1.24,.005),(x*1.22,y*1.24,.13),.105,.085,f'Leg_{end}_{side}',5)
    cone('Lowpoly tail',(0,.50,.29),(0,.80,.23),.065,.008,'Root',5)
    bpy.ops.object.select_all(action='DESELECT')
    for part in parts:part.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join()
    mesh=bpy.context.object;mesh.name='Tortoise | lowpoly skinned sculpture'
    mesh.parent=arm;mesh.matrix_parent_inverse=Matrix.Identity(4)
    mod=mesh.modifiers.new('Articulation','ARMATURE');mod.object=arm
    mesh['style']='Flat shaded lowpoly, original mesh'
    return mesh

def replace_current():
    arm=bpy.data.objects.get('Tortoise')
    if not arm or arm.type!='ARMATURE':raise RuntimeError('Tortoise rig not found')
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'work'/'companions-before-lowpoly.blend'),copy=True)
    old_meshes=[obj for obj in arm.children if obj.type=='MESH']
    old_triangles=sum(sum(len(p.vertices)-2 for p in obj.data.polygons) for obj in old_meshes)
    for obj in old_meshes:bpy.data.objects.remove(obj,do_unlink=True)
    mesh=create_lowpoly_tortoise(arm)
    scene=bpy.context.scene;scene.frame_set(1)
    # Studio placement is kept in the .blend, but exported web models stay at origin.
    original_matrix=arm.matrix_world.copy();arm.matrix_world=Matrix.Identity(4)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);mesh.select_set(True);bpy.context.view_layer.objects.active=arm
    bpy.ops.export_scene.gltf(filepath=str(OUT.parent/'strange-loop/assets/characters/tortoise.glb'),export_format='GLB',use_selection=True,
        export_animations=True,export_animation_mode='ACTIONS',export_anim_single_armature=False,
        export_materials='EXPORT',export_cameras=False,export_lights=False,export_force_sampling=True,
        export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
    arm.matrix_world=original_matrix;bpy.context.view_layer.update()
    stats={'old_triangles':old_triangles,'triangles':sum(len(p.vertices)-2 for p in mesh.data.polygons),
        'vertices':len(mesh.data.vertices),'flat_shaded':all(not p.use_smooth for p in mesh.data.polygons),
        'bones':[bone.name for bone in arm.data.bones]}
    (OUT/'tortoise-lowpoly.json').write_text(json.dumps(stats,indent=2))
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'geb-companions-lowpoly.blend'))
    print('LOWPOLY_TORTOISE_READY',stats)
    return mesh
