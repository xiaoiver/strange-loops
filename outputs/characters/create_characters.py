"""Build original, editable GEB companion prototypes in Blender. No external assets."""
import bpy, math, random, os
from mathutils import Vector
from pathlib import Path

OUT = Path(__file__).resolve().parent
ASSETS = OUT.parent / 'strange-loop' / 'assets' / 'characters'
ASSETS.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for action in list(bpy.data.actions): bpy.data.actions.remove(action)
random.seed(17)
scene = bpy.context.scene
scene.render.fps = 30

def material(name, color, roughness=.7):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=roughness
    return m
chalk=material('Limestone | figure',(.49,.50,.49))
linen=material('Chalk | short chiton',(.69,.70,.68),.85)
graphite=material('Graphite | hair and sandals',(.075,.082,.078),.76)
seam=material('Dark grey | small details',(.13,.145,.135),.82)
shell=material('Slate | tortoise shell',(.245,.27,.25),.64)
turtle_clay=material('Grey clay | tortoise',(.43,.46,.43),.79)

parts=[]
def finish(o,name,mat,bone):
    o.name=name
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    o.data.materials.append(mat)
    for face in o.data.polygons: face.use_smooth=True
    if bone:
        vg=o.vertex_groups.new(name=bone);vg.add(list(range(len(o.data.vertices))),1,'REPLACE')
    parts.append(o)
    return o

def ellipsoid(name,loc,scale,mat,bone,segments=24,rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc)
    o=bpy.context.object;o.scale=scale
    return finish(o,name,mat,bone)

def limb(name,a,b,r1,r2,mat,bone):
    # Soft taper with rounded ends, aligned with the bone's rest pose.
    a,b=Vector(a),Vector(b);axis=b-a;length=axis.length
    verts=[];faces=[];segments=16
    for frac,mul in [(0,.52),(.06,.88),(.22,1),(.7,.94),(.94,.8),(1,.48)]:
        radius=((1-frac)*r1+frac*r2)*mul
        for j in range(segments):
            t=j*math.tau/segments;v=Vector((radius*math.cos(t),radius*math.sin(t),frac*length))
            verts.append(a+Vector((0,0,1)).rotation_difference(axis.normalized())@v)
    for ring in range(5):
        for j in range(segments):
            k=ring*segments+j;n=ring*segments+(j+1)%segments
            faces.append((k,n,n+segments,k+segments))
    faces += [tuple(reversed(range(segments))),tuple(range(5*segments,6*segments))]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active=o;o.select_set(True)
    return finish(o,name,mat,bone)

def tube(name,points,radius,mat,bone,closed=False):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=1
    curve.bevel_depth=radius;curve.bevel_resolution=2
    spline=curve.splines.new('POLY');spline.points.add(len(points)-1)
    for p,co in zip(spline.points,points):p.co=(*co,1)
    spline.use_cyclic_u=closed
    o=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.object.convert(target='MESH')
    return finish(o,name,mat,bone)

def rings_mesh(name,rings,mat,bone,folds=0):
    verts=[];faces=[];N=48
    for z,rx,ry in rings:
        for j in range(N):
            t=math.tau*j/N;fold=1+folds*math.cos(12*t)
            verts.append((rx*math.cos(t)*fold,ry*math.sin(t)*fold,z))
    for k in range(len(rings)-1):
        for j in range(N):faces.append((k*N+j,k*N+(j+1)%N,(k+1)*N+(j+1)%N,(k+1)*N+j))
    faces += [tuple(reversed(range(N))),tuple(range((len(rings)-1)*N,len(rings)*N))]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active=o;o.select_set(True)
    return finish(o,name,mat,bone)

def rig(name,bones):
    bpy.ops.object.select_all(action='DESELECT')
    data=bpy.data.armatures.new(name+' skeleton');arm=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(arm);bpy.context.view_layer.objects.active=arm;arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for n,head,tail,parent in bones:
        bone=data.edit_bones.new(n);bone.head=head;bone.tail=tail
        if parent:bone.parent=data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT');arm.show_in_front=True
    for p in arm.pose.bones:p.rotation_mode='XYZ'
    return arm

def assemble(name,arm):
    bpy.ops.object.select_all(action='DESELECT')
    for part in parts:part.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join()
    mesh=bpy.context.object;mesh.name=name+' | skinned sculpture'
    mesh.parent=arm;mod=mesh.modifiers.new('Articulation','ARMATURE');mod.object=arm
    parts.clear()
    return mesh

def achilles():
    bones=[('Root',(0,0,0),(0,0,.2),None),('Pelvis',(0,0,1.15),(0,0,1.45),'Root'),
      ('Chest',(0,0,1.45),(0,0,1.97),'Pelvis'),('Head',(0,0,1.97),(0,0,2.43),'Chest')]
    for side,x in [('L',-.15),('R',.15)]:
        bones += [(f'Thigh_{side}',(x,0,1.18),(x,0,.65),'Pelvis'),(f'Shin_{side}',(x,0,.65),(x,0,.12),f'Thigh_{side}'),
          (f'Foot_{side}',(x,0,.12),(x,-.2,.08),f'Shin_{side}'),
          (f'Arm_{side}',(x*2.1,0,1.91),(x*2.55,0,1.56),'Chest'),
          (f'Forearm_{side}',(x*2.55,0,1.56),(x*2.5,-.01,1.21),f'Arm_{side}')]
    arm=rig('Achilles',bones)
    ellipsoid('Neck',(0,0,1.99),(.09,.09,.13),chalk,'Head')
    ellipsoid('Head',(0,-.018,2.23),(.15,.14,.205),chalk,'Head',32,20)
    ellipsoid('Jaw',(0,-.025,2.12),(.117,.115,.10),chalk,'Head')
    ellipsoid('Nose',(0,-.151,2.235),(.03,.061,.052),chalk,'Head',16,8)
    for side in [-1,1]:
        ellipsoid('Ear',(side*.15,0,2.23),(.026,.037,.058),chalk,'Head',16,8)
        ellipsoid('Eye',(side*.063,-.151,2.27),(.023,.008,.008),seam,'Head',16,8)
        tube('Brow',[(side*.039,-.151,2.292),(side*.067,-.155,2.297),(side*.09,-.14,2.29)],.007,chalk,'Head')
    tube('Mouth',[(-.037,-.132,2.155),(0,-.144,2.15),(.037,-.132,2.155)],.0035,seam,'Head')
    ellipsoid('Hair cap',(0,.012,2.365),(.16,.147,.13),graphite,'Head')
    for i in range(11):
        t=i*math.tau/11
        ellipsoid('Hair relief',(.142*math.cos(t),.126*math.sin(t)+.01,2.37+random.uniform(-.018,.015)),(.035,.033,.035),graphite,'Head',12,8)
    rings_mesh('Pleated chiton',[(1.02,.32,.205),(1.05,.325,.208),(1.16,.29,.19),(1.42,.205,.143),(1.48,.21,.145),(1.7,.275,.17),(1.89,.30,.155),(1.97,.205,.115)],linen,'Chest',.035)
    # Belt and folded edging keep the monochrome silhouette legible.
    tube('Belt',[(.216*math.cos(t*math.tau/64),.153*math.sin(t*math.tau/64),1.45) for t in range(64)],.019,graphite,'Chest',True)
    ellipsoid('Belt knot',(.02,-.166,1.44),(.043,.022,.032),chalk,'Chest',16,8)
    for side,x in [('L',-.15),('R',.15)]:
        limb('Thigh',(x,0,1.2),(x,0,.65),.107,.076,chalk,f'Thigh_{side}')
        ellipsoid('Knee',(x,0,.65),(.077,.078,.082),chalk,f'Shin_{side}')
        limb('Calf',(x,0,.65),(x,0,.12),.076,.045,chalk,f'Shin_{side}')
        ellipsoid('Foot',(x,-.075,.087),(.07,.155,.065),chalk,f'Foot_{side}')
        ellipsoid('Sandal',(x,-.075,.036),(.076,.16,.027),graphite,f'Foot_{side}')
        for y in [-.13,-.01]:tube('Sandal strap',[(x-.064,y,.09),(x,y-.006,.145),(x+.064,y,.09)],.009,graphite,f'Foot_{side}')
        shoulder=(x*2.1,0,1.91);elbow=(x*2.55,0,1.56);wrist=(x*2.5,-.01,1.21)
        ellipsoid('Shoulder',shoulder,(.087,.087,.095),chalk,f'Arm_{side}')
        limb('Upper arm',shoulder,elbow,.083,.055,chalk,f'Arm_{side}')
        ellipsoid('Elbow',elbow,(.054,.055,.057),chalk,f'Forearm_{side}')
        limb('Forearm',elbow,wrist,.055,.036,chalk,f'Forearm_{side}')
        ellipsoid('Hand',(wrist[0],-.018,1.16),(.044,.039,.081),chalk,f'Forearm_{side}')
    return arm,assemble('Achilles',arm)

def tortoise():
    bones=[('Root',(0,0,0),(0,0,.12),None),('Shell',(0,0,.3),(0,0,.68),'Root'),
           ('Head',(0,-.48,.3),(0,-.95,.37),'Root')]
    for side,x in [('L',-.38),('R',.38)]:
        for end,y in [('Front',-.42),('Back',.43)]:
            bones.append((f'Leg_{end}_{side}',(x,y,.28),(x*1.22,y*1.24,.07),'Root'))
    arm=rig('Tortoise',bones)
    import runpy
    builder=runpy.run_path(str(OUT/'lowpoly_tortoise.py'))
    return arm,builder['create_lowpoly_tortoise'](arm)

def make_clips(arm,kind):
    arm.animation_data_create();actions={}
    # Long, seamless idle phrases leave quiet intervals between small gestures.
    idle_frames=421 if kind=='human' else 541
    def gesture(t,start,end):
        return math.sin(math.pi*(t-start)/(end-start))**2 if start<t<end else 0
    for clip,frames in [('Idle',idle_frames),('Walk',31),('Look',61)]:
        action=bpy.data.actions.new(arm.name+'_'+clip);arm.animation_data.action=action
        for frame in range(1,frames+1,2):
            t=(frame-1)/(frames-1);phase=t*math.tau
            for b in arm.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0)
            if kind=='human':
                if clip=='Walk':
                    arm.pose.bones['Pelvis'].location.z=.018*(1-math.cos(2*phase))
                    for side,offset in [('L',0),('R',math.pi)]:
                        p=phase+offset
                        arm.pose.bones['Thigh_'+side].rotation_euler.x=.33*math.sin(p)
                        arm.pose.bones['Shin_'+side].rotation_euler.x=max(0,-math.sin(p))*.55
                        arm.pose.bones['Foot_'+side].rotation_euler.x=-.1*math.sin(p)
                        arm.pose.bones['Arm_'+side].rotation_euler.x=-.22*math.sin(p)
                        arm.pose.bones['Forearm_'+side].rotation_euler.x=-.12-.06*math.sin(p)
                    arm.pose.bones['Chest'].rotation_euler.y=.025*math.sin(phase)
                elif clip=='Look':
                    arm.pose.bones['Head'].rotation_euler.z=.55*math.sin(math.pi*t)**2
                    arm.pose.bones['Head'].rotation_euler.x=-.16*math.sin(math.pi*t)**2
                else:
                    breath=math.sin(phase*3)
                    glance=gesture(t,.28,.48)
                    settle=gesture(t,.69,.91)
                    chest=arm.pose.bones['Chest']
                    chest.rotation_euler.x=.012*breath
                    chest.rotation_euler.y=.018*math.sin(phase)
                    chest.location.x=.012*math.sin(phase)
                    arm.pose.bones['Head'].rotation_euler.z=.22*glance-.12*settle
                    arm.pose.bones['Head'].rotation_euler.x=-.075*glance+.035*settle
                    arm.pose.bones['Arm_L'].rotation_euler.x=.018*breath
                    arm.pose.bones['Arm_R'].rotation_euler.x=-.015*breath
                    arm.pose.bones['Forearm_R'].rotation_euler.x=-.07*settle
            else:
                if clip=='Walk':
                    arm.pose.bones['Root'].location.y=.003+.03*abs(math.sin(phase))
                    arm.pose.bones['Shell'].rotation_euler.y=.012*math.sin(phase)
                    for side,sign in [('L',1),('R',-1)]:
                        for end,offset in [('Front',0),('Back',math.pi)]:
                            b=arm.pose.bones[f'Leg_{end}_{side}'];b.rotation_euler.z=.18*math.sin(phase+offset)*sign
                            b.rotation_euler.x=.11*math.sin(phase+offset+(0 if side=='L' else math.pi))
                elif clip=='Look':
                    arm.pose.bones['Head'].rotation_euler.z=.3*math.sin(math.pi*t)**2
                    arm.pose.bones['Head'].rotation_euler.x=-.12*math.sin(math.pi*t)**2
                else:
                    peek=gesture(t,.12,.36)
                    glance=gesture(t,.57,.80)
                    head=arm.pose.bones['Head']
                    head.location.y=.045*peek
                    head.rotation_euler.x=.012*math.sin(phase*3)-.07*peek
                    head.rotation_euler.z=.18*glance
                    arm.pose.bones['Shell'].rotation_euler.y=.004*math.sin(phase*3)
                    arm.pose.bones['Leg_Front_L'].rotation_euler.z=.055*gesture(t,.36,.48)
                    arm.pose.bones['Leg_Front_R'].rotation_euler.z=-.045*gesture(t,.82,.94)
            for b in arm.pose.bones:
                b.keyframe_insert(data_path='rotation_euler',frame=frame,group=b.name)
                b.keyframe_insert(data_path='location',frame=frame,group=b.name)
        # Keep clips explicitly associated with this rig for glTF action export.
        track=arm.animation_data.nla_tracks.new();track.name=clip;track.strips.new(action.name,1,action);track.mute=True
        actions[clip]=action
    arm.animation_data.action=actions['Idle'];scene.frame_set(1)
    return actions

def export_character(name,arm,mesh):
    bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);mesh.select_set(True);bpy.context.view_layer.objects.active=arm
    bpy.ops.export_scene.gltf(filepath=str(ASSETS/(name+'.glb')),export_format='GLB',use_selection=True,
      export_animations=True,export_animation_mode='ACTIONS',export_anim_single_armature=False,
      export_materials='EXPORT',export_cameras=False,export_lights=False,export_force_sampling=True,
      export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)

ach,ach_mesh=achilles();ach_actions=make_clips(ach,'human');export_character('achilles',ach,ach_mesh)
tor,tor_mesh=tortoise();tor_actions=make_clips(tor,'tortoise');export_character('tortoise',tor,tor_mesh)
ach.location=(-.65,0,0);tor.location=(.72,-.22,0)
ach.animation_data.action=ach_actions['Walk'];tor.animation_data.action=tor_actions['Walk']
scene.frame_start=1;scene.frame_end=31;scene.frame_set(1)

# A simple studio for inspecting the two original models, not exported to the web.
floor=material('Studio | neutral floor',(.61,.63,.61),.9)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.006));bpy.context.object.name='Studio floor';bpy.context.object.data.materials.append(floor)
world=bpy.data.worlds.new('Studio daylight');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.72,.75,.72,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45;scene.world=world
def area(name,location,power,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=location;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
area('Large softbox',(-3,-4,6),650,5);area('Rim softbox',(3,2,5),450,4)
data=bpy.data.cameras.new('Portrait camera');cam=bpy.data.objects.new('Portrait camera',data);scene.collection.objects.link(cam)
cam.location=(4,-7,3.6);cam.rotation_euler=(Vector((0,-.08,1.15))-cam.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=4.25;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1300;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
for screen in bpy.data.screens:
    for area_ in screen.areas:
        if area_.type=='VIEW_3D':
            area_.spaces.active.region_3d.view_perspective='CAMERA'
            area_.spaces.active.shading.type='MATERIAL'
            area_.spaces.active.overlay.show_overlays=False
bpy.ops.object.select_all(action='DESELECT');ach.select_set(True);bpy.context.view_layer.objects.active=ach
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'geb-companions-lowpoly.blend'))
scene.render.filepath=str(OUT/'companions-preview.png');bpy.ops.render.render(write_still=True)
print('CHARACTERS_READY',str(OUT/'geb-companions-lowpoly.blend'))
