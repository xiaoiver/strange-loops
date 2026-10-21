import { createLetterPilePhysics } from './letter-pile-physics.js';
let simulation,active=false,timer;
function run(){
  timer=null;if(!active||!simulation||simulation.finished)return;
  const start=performance.now();
  for(let i=0;i<2;i++)simulation.step();
  const transforms=simulation.snapshot();postMessage({transforms,finished:simulation.finished},[transforms.buffer]);
  if(!simulation.finished)timer=setTimeout(run,Math.max(0,1000/30-(performance.now()-start)));
}
onmessage=({data})=>{
  if(data.type==='init')simulation=createLetterPilePhysics(data.definitions,{initialTransforms:data.initialTransforms});
  if(data.type==='active')active=data.value;
  if(active&&!timer)run();
  if(!active&&timer){clearTimeout(timer);timer=null;}
};
