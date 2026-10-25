"""Keep Formal's planted lower body; retarget natural Walk_Loop arms only.

Blender --background geb-companions-jog.blend --python this_file -- --asset CANDIDATE.glb
The input studio, tortoise and source clips are never overwritten.
"""
import bpy, hashlib, json, math, re, sys
from pathlib import Path
from mathutils import Matrix, Vector

OUT = Path(__file__).resolve().parent
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
asset = Path(args[args.index('--asset') + 1]).resolve() if '--asset' in args else OUT.parents[1] / 'work/companion-motion/achilles-candidate.glb'
asset.parent.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
arm = bpy.data.objects['Achilles']
studio = arm.matrix_world.copy()
arm.matrix_world = Matrix.Identity(4)
mesh = next(obj for obj in arm.children if obj.type == 'MESH')
original = bpy.data.actions['Achilles_Walk']
start, end = map(int, original.frame_range)
duration = end - start
for track in arm.animation_data.nla_tracks: track.mute = True
arm.animation_data.action = original

def base(name): return re.sub(r'_\d+$', '', name)
target = {base(bone.name): bone for bone in arm.pose.bones}
names = [f'{part}_{side}' for side in ('l', 'r') for part in ('clavicle', 'upperarm', 'lowerarm', 'hand')]
def curves(action):
    return [curve for layer in action.layers for strip in layer.strips for bag in strip.channelbags for curve in bag.fcurves]
def is_arm_curve(curve): return any(f'bones["{target[name].name}"]' in curve.data_path for name in names)
def lower_digest(action):
    data = [(c.data_path, c.array_index, [list(k.co) for k in c.keyframe_points]) for c in curves(action) if not is_arm_curve(c)]
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
unchanged = lower_digest(original)

# Measure current thigh timing before importing the independent source rig.
count = 120
formal = []
for sample in range(count):
    frame = start + duration * sample / count
    scene.frame_set(math.floor(frame), subframe=frame % 1)
    formal.append([(target[f'calf_{s}'].head - target[f'thigh_{s}'].head).normalized().y for s in ('l', 'r')])

before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(OUT / 'source/quaternius-walk-loop.glb'))
imported = set(bpy.data.objects) - before
src = next(obj for obj in imported if obj.type == 'ARMATURE')
source = bpy.data.actions['Walk_Loop']
src.animation_data.action = source
for track in src.animation_data.nla_tracks: track.mute = True
source_start, source_end = source.frame_range
source_duration = source_end - source_start
natural = []
for sample in range(count):
    frame = source_start + source_duration * sample / count
    scene.frame_set(math.floor(frame), subframe=frame % 1)
    natural.append([(src.pose.bones[f'calf_{s}'].head - src.pose.bones[f'thigh_{s}'].head).normalized().y for s in ('l', 'r')])
offset = min(range(count), key=lambda shift: sum((formal[i][side] - natural[(i + shift) % count][side])**2 for i in range(count) for side in range(2))) / count

# Calibrate the mannequin's A-pose to the source T-pose, then transfer global
# animation deltas. Copying source local Eulers would use incompatible axes.
arm.animation_data.action = None
for bone in arm.pose.bones: bone.matrix_basis = Matrix.Identity(4)
bpy.context.view_layer.update()
rest = {name: bone.bone.matrix_local.copy() for name, bone in target.items()}
srest = {bone.name: bone.bone.matrix_local.copy() for bone in src.pose.bones}
for side in ('l', 'r'):
    for name, child in [(f'upperarm_{side}', f'lowerarm_{side}'), (f'lowerarm_{side}', f'hand_{side}')]:
        bone = target[name]; head = bone.head.copy()
        direction = src.pose.bones[child].bone.head_local - src.pose.bones[name].bone.head_local
        q = (target[child].head - head).rotation_difference(direction)
        bone.matrix = Matrix.Translation(head) @ q.to_matrix().to_4x4() @ Matrix.Translation(-head) @ bone.matrix
        bpy.context.view_layer.update()
reference = {name: bone.matrix.copy() for name, bone in target.items()}

refined = original.copy(); refined.name = 'Achilles_Walk_NaturalArms'
for layer in refined.layers:
    for strip in layer.strips:
        for bag in strip.channelbags:
            for curve in list(bag.fcurves):
                if is_arm_curve(curve): bag.fcurves.remove(curve)
arm.animation_data.action = refined
previous = {}; first = {}; wrists = {'l': [], 'r': []}
for sample in range(duration + 1):
    scene.frame_set(start + sample)
    authored = {bone.name: bone.matrix_basis.copy() for bone in arm.pose.bones}
    frame = source_start + ((sample / duration + offset) % 1) * source_duration
    scene.frame_set(math.floor(frame), subframe=frame % 1)
    source_rotations = {name: src.pose.bones[name].matrix.to_quaternion() @ srest[name].to_quaternion().inverted() for name in names}
    for bone in arm.pose.bones: bone.matrix_basis = authored[bone.name]
    bpy.context.view_layer.update()
    for name in names:
        bone = target[name]
        reference_q = rest[name].to_quaternion() if name.startswith('clavicle') else reference[name].to_quaternion()
        matrix = (source_rotations[name] @ reference_q).to_matrix().to_4x4()
        matrix.translation = bone.head.copy(); bone.matrix = matrix
        bpy.context.view_layer.update()
        bone.rotation_mode = 'QUATERNION'
        q = bone.rotation_quaternion.copy()
        if name in previous and q.dot(previous[name]) < 0: q.negate()
        bone.rotation_quaternion = q; previous[name] = q.copy()
        if sample == 0: first[name] = (bone.location.copy(), q.copy(), bone.scale.copy())
        if sample == duration: bone.location, bone.rotation_quaternion, bone.scale = first[name]
        for path in ('location', 'rotation_quaternion', 'scale'): bone.keyframe_insert(data_path=path, frame=start + sample, group=bone.name)
    for side in ('l', 'r'): wrists[side].append(target[f'hand_{side}'].head.y)
assert lower_digest(refined) == unchanged, 'A non-arm track was changed'
for curve in curves(refined):
    if is_arm_curve(curve):
        for key in curve.keyframe_points: key.interpolation = 'LINEAR'
for track in arm.animation_data.nla_tracks:
    for strip in track.strips:
        if strip.action == original: strip.action = refined
bpy.data.actions.remove(original); refined.name = 'Achilles_Walk'
for obj in imported: bpy.data.objects.remove(obj, do_unlink=True)
bpy.data.actions.remove(source)
arm['walk_upper_body_source_clip'] = 'Walk_Loop'
arm['walk_upper_body_phase_offset'] = offset
arm['walk_upper_body_license'] = 'CC0-1.0'
arm['walk_adaptation'] += ' Natural Walk_Loop shoulder, arm and elbow motion retargeted and phase-aligned; original Formal lower-body curves unchanged.'
arm.animation_data.action = refined
scene.frame_set(start)
bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); mesh.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=str(asset), export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='ACTIONS', export_anim_single_armature=False,
    export_anim_slide_to_zero=True, export_force_sampling=False, export_materials='EXPORT',
    export_cameras=False, export_lights=False, export_extras=True,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6)
report = {'source_clip':'Walk_Loop','base_lower_body':'Walk_Formal_Loop','license':'CC0-1.0',
    'phase_offset':offset,'seconds':duration / scene.render.fps,'non_arm_curves_unchanged':True,
    'non_arm_curves_sha256':unchanged,'hand_forward_ranges':{s:max(values)-min(values) for s,values in wrists.items()},
    'glb_bytes':asset.stat().st_size}
assert min(report['hand_forward_ranges'].values()) > .2, report
(OUT / 'mannequin-natural-arms.json').write_text(json.dumps(report, indent=2) + '\n')
arm.matrix_world = studio; arm.animation_data.action = bpy.data.actions['Achilles_Idle']; scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'geb-companions-motion.blend'))
print('NATURAL_ARMS_READY', json.dumps(report))
