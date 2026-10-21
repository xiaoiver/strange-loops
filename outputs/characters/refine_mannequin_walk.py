"""Bake a foot-planted slow walk onto the existing POLLO28 mannequin rig.
Blender --background geb-companions-mannequin.blend --python this_file
Preserves the original studio, geometry, Idle and Look; writes a new .blend.
"""
import bpy, math, json, struct
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
OUT=Path(__file__).resolve().parent
ASSET=OUT.parent/'strange-loop/assets/characters/achilles.glb'
PROOF=OUT.parent.parent/'work/walk-refinement'
PROOF.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene;scene.render.fps=30
arm=bpy.data.objects['Achilles'];studio=arm.matrix_world.copy()
obj=next(o for o in arm.children if o.type=='MESH')
arm.animation_data.action=None
for track in list(arm.animation_data.nla_tracks):
    track.mute=True
    if track.name=='Walk':arm.animation_data.nla_tracks.remove(track)
for action in list(bpy.data.actions):
    if action.name=='Achilles_Walk':bpy.data.actions.remove(action)
for p in arm.pose.bones:p.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
def bone(prefix):
    found=[p for p in arm.pose.bones if p.name.startswith(prefix+'_')]
    assert len(found)==1,(prefix,[p.name for p in found])
    return found[0]
def aim(joint,child,direction):
    p=bone(joint);end=bone(child);head=p.head.copy()
    delta=(end.head-head).rotation_difference(Vector(direction))
    p.matrix=Matrix.Translation(head)@delta.to_matrix().to_4x4()@Matrix.Translation(-head)@p.matrix
    bpy.context.view_layer.update()
for side,sign in [('l',1),('r',-1)]:
    aim('upperarm_'+side,'lowerarm_'+side,(sign*.055,0,-.39))
    aim('lowerarm_'+side,'hand_'+side,(sign*.015,-.045,-.34))
neutral={p.name:p.matrix_basis.copy() for p in arm.pose.bones}
feet={side:bone('foot_'+side).matrix.copy() for side in ['l','r']}
lengths={side:((bone('calf_'+side).head-bone('thigh_'+side).head).length,(bone('foot_'+side).head-bone('calf_'+side).head).length) for side in ['l','r']}
pivots={}
for side in ['l','r']:
    sole=[v.co.copy() for v in obj.data.vertices if v.co.z<.035 and sum(g.weight for g in v.groups if obj.vertex_groups[g.group].name.startswith(('foot_'+side+'_','ball_'+side+'_')))>.5]
    pivots[side]={'toe':min(sole,key=lambda v:v.y)-feet[side].translation,'heel':max(sole,key=lambda v:v.y)-feet[side].translation}
pelvis=bone('pelvis');pelvis_base=pelvis.matrix.copy()
D=1.05 # model-space forward distance per complete left/right cycle
STANCE=.62;FRAMES=37 # 1.2 seconds at 30fps, including matching loop endpoint

def rotate(prefix,axis,angle):
    p=bone(prefix);m=p.matrix.copy();head=m.translation.copy()
    p.matrix=Matrix.Translation(head)@Quaternion(Vector(axis),angle).to_matrix().to_4x4()@Matrix.Translation(-head)@m
    bpy.context.view_layer.update()
def smooth(t):return t*t*t*(t*(t*6-15)+10)
def foot_pose(u,side):
    rest=feet[side];base=rest.translation.copy()
    # A planted foot travels backwards by exactly the body's forward travel.
    y=D*(u-STANCE/2);lift=0;pitch=0;pivot=Vector((0,0,0))
    if u<STANCE:
        if u<.12:
            pitch=-math.radians(9)*(1-smooth(u/.12));pivot=pivots[side]['heel']
        elif u>.44:
            pitch=math.radians(19)*smooth((u-.44)/(STANCE-.44));pivot=pivots[side]['toe']
    else:
        s=(u-STANCE)/(1-STANCE)
        y-=D*smooth(s)
        lift=.115*math.sin(math.pi*s)**2
        # Release the toes, clear the floor, then present the heel for contact.
        release=1-smooth(min(1,s/.30));landing=smooth(max(0,(s-.60)/.40))
        pitch=math.radians(19)*release-math.radians(9)*landing
        pivot=pivots[side]['toe'] if pitch>=0 else pivots[side]['heel']
    tilt=Quaternion(Vector((1,0,0)),pitch)
    target=Vector((base.x*.72,y+base.y,base.z+lift+.0004))+pivot-tilt@pivot
    orientation=tilt.to_matrix()@rest.to_3x3()
    return target,orientation

def leg(side,target,orientation):
    hip=bone('thigh_'+side);knee=bone('calf_'+side);foot=bone('foot_'+side)
    h=hip.head.copy();v=target-h;d=v.length;upper,lower=lengths[side]
    assert d<upper+lower,(side,d,upper+lower)
    axis=v.normalized();a=(upper*upper-lower*lower+d*d)/(2*d)
    pole=Vector((0,-1,0));bend=(pole-axis*pole.dot(axis)).normalized()
    k=h+axis*a+bend*math.sqrt(max(0,upper*upper-a*a))
    aim('thigh_'+side,'calf_'+side,k-h)
    aim('calf_'+side,'foot_'+side,target-knee.head)
    m=orientation.to_4x4();m.translation=foot.head.copy();foot.matrix=m
    bpy.context.view_layer.update()

walk=bpy.data.actions.new('Achilles_Walk');walk.use_fake_user=True;arm.animation_data.action=walk
measure=[]
for frame in range(FRAMES):
    scene.frame_set(frame)
    for p in arm.pose.bones:p.matrix_basis=neutral[p.name].copy()
    bpy.context.view_layer.update()
    t=frame/(FRAMES-1);phase=math.tau*t
    m=pelvis_base.copy();m.translation+=Vector((.024*math.sin(phase),0,-.062-.012*math.cos(2*phase)));pelvis.matrix=m
    bpy.context.view_layer.update()
    rotate('pelvis',(0,0,1),-.03*math.cos(phase))
    rotate('pelvis',(0,1,0),.016*math.sin(phase))
    rotate('spine_03',(0,0,1),.038*math.cos(phase))
    rotate('spine_03',(1,0,0),.025)
    for side,offset in [('l',0),('r',.5)]:
        u=(t+offset)%1
        target,orientation=foot_pose(u,side);leg(side,target,orientation)
        q=phase+offset*math.tau
        rotate('upperarm_'+side,(1,0,0),.14*math.cos(q))
        rotate('lowerarm_'+side,(1,0,0),-.10-.035*math.sin(q))
    rotate('head',(0,0,1),-.012*math.cos(phase))
    for p in arm.pose.bones:
        p.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=p.name)
        p.keyframe_insert(data_path='location',frame=frame,group=p.name)
        p.keyframe_insert(data_path='scale',frame=frame,group=p.name)
    evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());surface=evaluated.to_mesh()
    clearance=min((evaluated.matrix_world@v.co).z for v in surface.vertices);evaluated.to_mesh_clear()
    assert clearance>-.001,('foot below floor',frame,clearance)
    measure.append({'frame':frame,'clearance':clearance,'feet':{side:list(bone('foot_'+side).head) for side in ['l','r']}})
for layer in walk.layers:
    for strip in layer.strips:
        for bag in strip.channelbags:
            for curve in bag.fcurves:
                for key in curve.keyframe_points:key.interpolation='LINEAR'
                values=[key.co.y for key in curve.keyframe_points]
                if max(values)-min(values)<1e-6:
                    for key in list(curve.keyframe_points)[1:-1][::-1]:curve.keyframe_points.remove(key,fast=True)
track=arm.animation_data.nla_tracks.new();track.name='Walk';track.strips.new(walk.name,0,walk);track.mute=True
arm['walk_cycle_distance']=D
arm['walk_cycle_seconds']=(FRAMES-1)/scene.render.fps
arm['walk_adaptation']='Foot-planted two-bone IK bake; heel/toe roll, pelvis weight shift, counter-swing; in-place, distance-driven at runtime.'
arm.matrix_world=Matrix.Identity(4)
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);obj.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(ASSET),export_format='GLB',use_selection=True,
    export_animations=True,export_animation_mode='ACTIONS',export_anim_single_armature=False,
    export_anim_slide_to_zero=True,export_force_sampling=False,export_materials='EXPORT',export_cameras=False,export_lights=False,
    export_extras=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
raw=ASSET.read_bytes();g=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
assert {a['name'] for a in g['animations']}=={'Achilles_Idle','Achilles_Look','Achilles_Walk'}
report={'model_cycle_distance':D,'web_cycle_distance':D*.6,'seconds':1.2,'stance_fraction':STANCE,'frames':FRAMES,'glb_bytes':len(raw),'minimum_clearance':min(s['clearance'] for s in measure),'maximum_clearance':max(s['clearance'] for s in measure),'samples':measure}
(PROOF/'gait-measurements.json').write_text(json.dumps(report,indent=2))
optimization=json.loads((OUT/'mannequin-optimization.json').read_text());optimization['glb_bytes']=len(raw);optimization['walk_cycle_distance']=D;optimization['walk_cycle_seconds']=1.2
(OUT/'mannequin-optimization.json').write_text(json.dumps(optimization,indent=2)+'\n')
(OUT/'mannequin-walk.json').write_text(json.dumps({k:v for k,v in report.items() if k!='samples'},indent=2)+'\n')
arm.matrix_world=studio
arm.animation_data.action=next(a for a in bpy.data.actions if a.name=='Achilles_Idle');scene.frame_start=1;scene.frame_end=421;scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'geb-companions-walk.blend'))
# Quick render evidence: side view at four gait phases, using the real shaded mesh.
arm.animation_data.action=walk
bpy.data.objects['Tortoise'].hide_render=True
for child in bpy.data.objects['Tortoise'].children:child.hide_render=True
cam=scene.camera;target=arm.matrix_world@Vector((0,0,1.2));cam.location=target+Vector((5,-.8,1.1));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=3.05
scene.render.resolution_x=620;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.render.engine='CYCLES';scene.cycles.samples=12
for frame in [0,9,18,27]:
    scene.frame_set(frame);scene.render.filepath=str(PROOF/f'walk-{frame:02}.png');bpy.ops.render.render(write_still=True)
print('WALK_READY',json.dumps({k:v for k,v in report.items() if k!='samples'}))
