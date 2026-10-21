import { World, Body, Plane, Vec3, Material, ContactMaterial, SAPBroadphase, ConvexPolyhedron } from 'cannon-es';
import { PILE_COUNT, PILE_FLOOR } from './letter-pile-config.js';
export { PILE_COUNT, PILE_FLOOR } from './letter-pile-config.js';
export function createLetterPilePhysics(definitions,{count=PILE_COUNT,seed=7391,initialTransforms=null}={}){
  let randomSeed=seed>>>0;
  const random=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;};
  const world=new World({gravity:new Vec3(0,-9.82,0),allowSleep:true});
  world.broadphase=new SAPBroadphase(world);world.solver.iterations=8;world.solver.tolerance=.001;
  const material=new Material('letters');
  world.addContactMaterial(new ContactMaterial(material,material,{friction:.85,restitution:0,contactEquationStiffness:1e7,contactEquationRelaxation:4}));
  const floor=new Body({mass:0,material,shape:new Plane(),position:new Vec3(0,PILE_FLOOR,0)});
  floor.quaternion.setFromEuler(-Math.PI/2,0,0);world.addBody(floor);
  // Real gallery walls, well outside the pile, prevent letters escaping through the room.
  for(const axis of ['x','z']){
    const wall=new Body({mass:0,material,shape:new Plane()});wall.position[axis]=-3.8;
    if(axis==='x')wall.quaternion.setFromEuler(0,Math.PI/2,0);
    world.addBody(wall);
  }
  const shapes=definitions.map(d=>d.pieces.map(p=>({shape:new ConvexPolyhedron({vertices:p.vertices.map(v=>new Vec3(...v)),faces:p.faces}),offset:new Vec3(...p.offset)})));
  const bodies=[],indices=[];
  let time=0,nextDrop=0,finished=false,quietTime=0;
  function drop(){
    const index=bodies.length%definitions.length,angle=random()*Math.PI*2,radius=Math.sqrt(random())*.42;
    const body=new Body({mass:.45,material,linearDamping:.4,angularDamping:.5,allowSleep:true,sleepSpeedLimit:.25,sleepTimeLimit:1});
    for(const {shape,offset} of shapes[index])body.addShape(shape,offset);
    body.position.set(.65+Math.cos(angle)*radius,-1.6+random()*.2,.8+Math.sin(angle)*radius);
    body.quaternion.setFromEuler(-Math.PI/2+(random()-.5)*.8,random()*Math.PI*2,(random()-.5)*.8);
    body.angularVelocity.set((random()-.5)*2,(random()-.5)*2,(random()-.5)*2);
    if(initialTransforms){
      const offset=bodies.length*7;
      body.position.set(...initialTransforms.slice(offset,offset+3));
      body.quaternion.set(...initialTransforms.slice(offset+3,offset+7));body.quaternion.normalize();
      body.angularVelocity.setZero();
    }
    world.addBody(body);bodies.push(body);indices.push(index);
  }
  if(initialTransforms)while(bodies.length<count)drop();
  function step(){
    if(finished)return false;
    time+=1/60;
    if(time>=nextDrop&&bodies.length<count){drop();nextDrop=time+.065;}
    world.step(1/60);
    // Compound contacts can keep nudging a resting stack awake. End only after
    // every body has stayed below a small motion threshold for two seconds.
    const quiet=bodies.length===count&&bodies.every(b=>b.velocity.lengthSquared()<.01&&b.angularVelocity.lengthSquared()<.25);
    quietTime=quiet?quietTime+1/60:0;
    if(quietTime>=2)bodies.forEach(b=>b.sleep());
    finished=bodies.length===count&&bodies.every(b=>b.sleepState===Body.SLEEPING);
    return true;
  }
  function snapshot(){
    const transforms=new Float32Array(count*7);transforms.fill(NaN);
    bodies.forEach((b,i)=>{transforms.set([b.position.x,b.position.y,b.position.z,b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w],i*7);});
    return transforms;
  }
  return {step,snapshot,bodies,indices,world,get finished(){return finished;},get time(){return time;}};
}
