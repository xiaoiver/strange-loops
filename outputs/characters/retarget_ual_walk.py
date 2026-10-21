"""Retarget Quaternius locomotion onto the existing POLLO28 mannequin in Blender.
Default: Walk_Formal_Loop from geb-companions-walk.blend.
Add jogging: geb-companions-ual.blend, --clip Jog_Fwd_Loop.
Reference clips are preserved in source/.
Keeps mesh, skin, materials, Idle/Look and tortoise. Writes a new studio file.
"""
import bpy, math, json, struct, re, sys
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
OUT=Path(__file__).resolve().parent
PROOF=OUT.parent.parent/'work/ual-retarget';PROOF.mkdir(parents=True,exist_ok=True)
ASSET=OUT.parent/'strange-loop/assets/characters/achilles.glb'
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
CLIP=args[args.index('--clip')+1] if '--clip' in args else 'Walk_Formal_Loop'
assert CLIP in ['Walk_Formal_Loop','Jog_Fwd_Loop'],CLIP
MODE='Jog' if CLIP=='Jog_Fwd_Loop' else 'Walk'
PREFIX=MODE.lower()
SOURCE='quaternius-jog-fwd-loop.glb' if MODE=='Jog' else 'quaternius-walk-formal-loop.glb'
# Fit the library's very long running stride to a light gallery jog.
STRIDE_GAIN=.30 if MODE=='Jog' else 1
LIFT_GAIN=.65 if MODE=='Jog' else 1
scene=bpy.context.scene;scene.render.fps=30
arm=bpy.data.objects['Achilles'];studio=arm.matrix_world.copy();arm.matrix_world=Matrix.Identity(4)
mesh=next(o for o in arm.children if o.type=='MESH')
arm.animation_data.action=None
for track in list(arm.animation_data.nla_tracks):
 track.mute=True
 if track.name==MODE:arm.animation_data.nla_tracks.remove(track)
for a in list(bpy.data.actions):
 if a.name=='Achilles_'+MODE:bpy.data.actions.remove(a)
for p in arm.pose.bones:p.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
def base(name):return re.sub(r'_\d+$','',name)
target={base(p.name):p for p in arm.pose.bones}
def bone(name):return target[name]
def aim(name,child,direction):
 p=bone(name);head=p.head.copy()
 q=(bone(child).head-head).rotation_difference(direction)
 p.matrix=Matrix.Translation(head)@q.to_matrix().to_4x4()@Matrix.Translation(-head)@p.matrix
 bpy.context.view_layer.update()
old=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(OUT/'source'/SOURCE))
source_objects=set(bpy.data.objects)-old
src=next(o for o in source_objects if o.type=='ARMATURE')
srcmesh=max((o for o in source_objects if o.type=='MESH'),key=lambda o:len(o.data.vertices))
source_walk=bpy.data.actions[CLIP];src.animation_data.action=source_walk
for track in src.animation_data.nla_tracks:track.mute=True
srcbones=src.pose.bones
rest={name:p.bone.matrix_local.copy() for name,p in target.items()}
srest={p.name:p.bone.matrix_local.copy() for p in srcbones}
# Calibrate the target A-pose to the source T-pose before transferring global deltas.
# This preserves the target's bone axes, rather than copying incompatible Eulers.
for side in ['l','r']:
 for name,child in [('upperarm_'+side,'lowerarm_'+side),('lowerarm_'+side,'hand_'+side)]:
  aim(name,child,srcbones[child].bone.head_local-srcbones[name].bone.head_local)
reference={name:p.matrix.copy() for name,p in target.items()}
for p in arm.pose.bones:p.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
lengths={s:((bone('calf_'+s).head-bone('thigh_'+s).head).length,(bone('foot_'+s).head-bone('calf_'+s).head).length) for s in ['l','r']}
slen=sum((srcbones[b].bone.head_local-srcbones[a].bone.head_local).length for a,b in [('thigh_l','calf_l'),('calf_l','foot_l')])
ratio=sum(lengths['l'])/slen
start,end=map(int,source_walk.frame_range);frames=end-start
scene.frame_set(start);root0=srcbones['root'].head.copy()
scene.frame_set(end);root1=srcbones['root'].head.copy()
travel=root1-root0;distance=travel.length*ratio*STRIDE_GAIN
assert travel.y<0 and abs(travel.x)<.001

def shoe_indices(obj,side):
 names={g.index for g in obj.vertex_groups if re.match(r'(foot|ball)_'+side+r'($|_)',g.name)}
 return [v.index for v in obj.data.vertices if sum(g.weight for g in v.groups if g.group in names)>.5]
shoe={s:shoe_indices(mesh,s) for s in ['l','r']}
sshoe={s:shoe_indices(srcmesh,s) for s in ['l','r']}
assert all(shoe.values()) and all(sshoe.values())
def clearances(obj,indices):
 evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());data=evaluated.to_mesh()
 result={s:min((evaluated.matrix_world@data.vertices[i].co).z for i in indices[s]) for s in indices}
 evaluated.to_mesh_clear();return result

def orient(p,q):
 m=q.to_matrix().to_4x4();m.translation=p.head.copy();p.matrix=m
 bpy.context.view_layer.update()
def delta(name):return srcbones[name].matrix.to_quaternion()@srest[name].to_quaternion().inverted()
def foot_delta(name):
 q=delta(name)
 if MODE!='Jog':return q
 # Use an anatomical foot frame, not the source rig's mirrored local axes.
 # The original clip points the sole past vertical during heel recovery; keep
 # this compact jog within forward-facing pitch/roll limits instead.
 right=q@Vector((1,0,0));forward=q@Vector((0,-1,0))
 yaw=math.atan2(right.y,right.x)
 yaw_q=Quaternion(Vector((0,0,1)),yaw)
 local=yaw_q.inverted()@forward
 pitch=math.atan2(-local.z,-local.y)
 pitch=max(math.radians(-30),min(math.radians(75),pitch))
 roll=max(math.radians(-12),min(math.radians(12),math.atan2(-right.z,math.hypot(right.x,right.y))))
 return yaw_q@Quaternion(Vector((1,0,0)),pitch)@Quaternion(Vector((0,1,0)),roll)

# Map the three source spine segments continuously over five target segments.
spine_names=['pelvis','spine_01','spine_02','spine_03','neck_01','Head']
sz=[(srest[n].translation.z-srest['pelvis'].translation.z)/(srest['neck_01'].translation.z-srest['pelvis'].translation.z) for n in spine_names]
def body_delta(fraction):
 for i in range(len(sz)-1):
  if fraction<=sz[i+1]:return delta(spine_names[i]).slerp(delta(spine_names[i+1]),max(0,(fraction-sz[i])/(sz[i+1]-sz[i])))
 return delta('Head')
max_reach_correction=0

def leg(side,goal,rotation,ball_rotation):
 global max_reach_correction
 hip=bone('thigh_'+side);knee=bone('calf_'+side);foot=bone('foot_'+side)
 h=hip.head.copy();v=goal-h;d=v.length;upper,lower=lengths[side]
 limit=upper+lower-.00001
 if d>limit:
  max_reach_correction=max(max_reach_correction,d-limit);goal=h+v*(limit/d);v=goal-h;d=limit
 axis=v.normalized();a=(upper*upper-lower*lower+d*d)/(2*d)
 pole=srcbones['calf_'+side].head-srcbones['thigh_'+side].head
 if MODE=='Jog':
  # Remove the source leg's axial component BEFORE fitting the shorter target
  # stride. Projecting the whole source thigh onto the compressed target axis
  # can cross zero and invert the knee (and force a compensating ankle twist).
  source_axis=(srcbones['foot_'+side].head-srcbones['thigh_'+side].head).normalized()
  pole-=source_axis*pole.dot(source_axis)
  forward=delta('pelvis')@Vector((0,-1,0))
  if pole.length<.0001 or pole.dot(forward)<=0:pole=forward
 bend=pole-axis*pole.dot(axis)
 if bend.length<.0001:bend=Vector((0,-1,0))-axis*axis.dot(Vector((0,-1,0)))
 k=h+axis*a+bend.normalized()*math.sqrt(max(0,upper*upper-a*a))
 aim('thigh_'+side,'calf_'+side,k-h)
 aim('calf_'+side,'foot_'+side,goal-knee.head)
 orient(foot,rotation);orient(bone('ball_'+side),ball_rotation)

walk=bpy.data.actions.new('Achilles_'+MODE);walk.use_fake_user=True;arm.animation_data.action=walk
samples=[];previous={};first={}
for frame in range(frames+1):
 scene.frame_set(start+frame)
 for p in arm.pose.bones:p.matrix_basis=Matrix.Identity(4)
 bpy.context.view_layer.update()
 root=srcbones['root'].head.copy()
 pelvis=bone('pelvis');q=delta('pelvis')@rest['pelvis'].to_quaternion()
 offset=(srcbones['pelvis'].head-root-srest['pelvis'].translation)*ratio
 offset.y*=STRIDE_GAIN;offset.z*=LIFT_GAIN
 m=q.to_matrix().to_4x4();m.translation=rest['pelvis'].translation+offset
 pelvis.matrix=m;bpy.context.view_layer.update()
 for name in ['spine_01','spine_02','spine_03','spine_04','spine_05','neck_01','neck_02','head']:
  frac=(rest[name].translation.z-rest['pelvis'].translation.z)/(rest['neck_01'].translation.z-rest['pelvis'].translation.z)
  orient(bone(name),body_delta(frac)@rest[name].to_quaternion())
 for side in ['l','r']:
  name='clavicle_'+side;orient(bone(name),delta(name)@rest[name].to_quaternion())
  for name in ['upperarm_'+side,'lowerarm_'+side,'hand_'+side]:
   orient(bone(name),delta(name)@reference[name].to_quaternion())
  for name,p in target.items():
   if re.match(r'(thumb|index|middle|ring|pinky)_\d+_'+side+'$',name) and name in srest:
    orient(p,delta(name)@reference[name].to_quaternion())
 source_clear=clearances(srcmesh,sshoe)
 goals={};rotations={};ballrot={}
 for side in ['l','r']:
  name='foot_'+side
  offset=(srcbones[name].head-root-srest[name].translation)*ratio
  offset.y*=STRIDE_GAIN;offset.z*=LIFT_GAIN
  goal=rest[name].translation+offset
  # Avoid inheriting the target's unusually wide A-pose ankle spacing.
  goal.x+=(.18 if side=='l' else -.18)-rest[name].translation.x
  goals[side]=goal;rotations[side]=foot_delta(name)@rest[name].to_quaternion()
  name='ball_'+side;ballrot[side]=foot_delta(name)@rest[name].to_quaternion()
  leg(side,goal,rotations[side],ballrot[side])
 # Transfer actual sole clearance, correcting for different shoes and foot lengths.
 # The library supplies the support/swing timing; these are fitting corrections.
 for iteration in range(3):
  actual=clearances(mesh,shoe)
  for side in ['l','r']:
   desired=max(0,source_clear[side])*ratio*LIFT_GAIN+.001
   goals[side].z+=desired-actual[side]
   leg(side,goals[side],rotations[side],ballrot[side])
 actual=clearances(mesh,shoe)
 for p in arm.pose.bones:
  p.rotation_mode='QUATERNION'
  q=p.rotation_quaternion.copy()
  if p.name in previous and q.dot(previous[p.name])<0:q.negate()
  p.rotation_quaternion=q;previous[p.name]=q.copy()
  if frame==0:first[p.name]=(p.location.copy(),q.copy(),p.scale.copy())
  if frame==frames:p.location,p.rotation_quaternion,p.scale=first[p.name]
  for path in ['location','rotation_quaternion','scale']:p.keyframe_insert(data_path=path,frame=frame,group=p.name)
 samples.append({'frame':frame,'clearance':actual,'source_clearance':source_clear,'feet':{s:list(bone('foot_'+s).head) for s in ['l','r']},'toes':{s:list(bone('ball_'+s).head) for s in ['l','r']}})
for layer in walk.layers:
 for strip in layer.strips:
  for bag in strip.channelbags:
   for curve in bag.fcurves:
    for key in curve.keyframe_points:key.interpolation='LINEAR'
    values=[key.co.y for key in curve.keyframe_points]
    if max(values)-min(values)<1e-6:
     for key in list(curve.keyframe_points)[1:-1][::-1]:curve.keyframe_points.remove(key,fast=True)
# Fit stride to the retargeted toe's actual support travel, including shoe roll.
root_distance=distance
if MODE=='Jog':
 contact=[(s,a,b) for s,a,b in [('l',3,5),('r',17,19)]]
 distance=sum((samples[b]['toes'][s][1]-samples[a]['toes'][s][1])*frames/(b-a) for s,a,b in contact)/len(contact)
 assert distance>0
track=arm.animation_data.nla_tracks.new();track.name=MODE;track.strips.new(walk.name,0,walk);track.mute=True
arm[PREFIX+'_cycle_distance']=distance;arm[PREFIX+'_cycle_seconds']=frames/30
arm[PREFIX+'_stride_gain']=STRIDE_GAIN;arm[PREFIX+'_lift_gain']=LIFT_GAIN
arm[PREFIX+'_adaptation']=f'Quaternius {CLIP} (CC0): rest-pose retarget, proportional pelvis/limbs, anatomical knee-plane and shoe-contact IK fitting; root motion removed and distance-driven at runtime.'
arm[PREFIX+'_source']='https://quaternius.com/packs/universalanimationlibrary.html'
arm[PREFIX+'_source_clip']=CLIP;arm[PREFIX+'_license']='CC0-1.0';arm[PREFIX+'_author']='Quaternius'
assert min(min(s['clearance'].values()) for s in samples)>-.001
assert max_reach_correction<.01
# Remove reference objects/actions from the delivered studio and export only Achilles.
for o in source_objects:bpy.data.objects.remove(o,do_unlink=True)
bpy.data.actions.remove(source_walk)
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);mesh.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(ASSET),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_anim_single_armature=False,export_anim_slide_to_zero=True,export_force_sampling=False,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
raw=ASSET.read_bytes();g=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
assert {'Achilles_Idle','Achilles_Look','Achilles_Walk','Achilles_'+MODE}.issubset({a['name'] for a in g['animations']})
report={'source':'Quaternius Universal Animation Library Standard','clip':CLIP,'license':'CC0-1.0','source_cycle_distance':travel.length,'leg_scale':ratio,'stride_gain':STRIDE_GAIN,'lift_gain':LIFT_GAIN,'root_based_cycle_distance':root_distance,'model_cycle_distance':distance,'web_cycle_distance':distance*.6,'seconds':frames/30,'frames':frames+1,'glb_bytes':len(raw),'minimum_clearance':min(min(s['clearance'].values()) for s in samples),'maximum_reach_correction':max_reach_correction}
assert report['minimum_clearance']>-.001,report
assert max_reach_correction<.01,report
(PROOF/f'{PREFIX}-measurements.json').write_text(json.dumps({**report,'samples':samples},indent=2))
(OUT/f'mannequin-{PREFIX}.json').write_text(json.dumps(report,indent=2)+'\n')
optimization=json.loads((OUT/'mannequin-optimization.json').read_text());optimization.update(glb_bytes=len(raw));optimization.update({PREFIX+'_cycle_distance':distance,PREFIX+'_cycle_seconds':frames/30});optimization['animations']=[a['name'] for a in g['animations']];optimization.pop('clips',None)
(OUT/'mannequin-optimization.json').write_text(json.dumps(optimization,indent=2)+'\n')
arm.matrix_world=studio
arm.animation_data.action=bpy.data.actions['Achilles_Idle'];scene.frame_start=1;scene.frame_end=421;scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/('geb-companions-jog.blend' if MODE=='Jog' else 'geb-companions-ual.blend')))
print('RETARGET_READY',json.dumps(report))
