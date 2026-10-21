import Tick from '@pqina/flip';
import '@pqina/flip/dist/flip.min.css';

// Keep a single readable number; the split-flap layers are purely visual.
export function createChapterCounter(root, reduced) {
 const label=root.querySelector('b');
 const visual=document.createElement('span');
 visual.className='chapter-flaps';visual.setAttribute('aria-hidden','true');
 root.append(visual);
 let value=label.textContent, ticks=[];
 function mount(){
  ticks.forEach(tick=>Tick.DOM.destroy(tick.root));ticks=[];visual.replaceChildren();
  const animated=!reduced.matches&&Tick.supported;
  label.classList.toggle('sr-only',animated);visual.hidden=!animated;
  if(!animated)return;
  for(const digit of value){
   const holder=document.createElement('span');holder.className='tick chapter-digit';visual.append(holder);
   ticks.push(Tick.DOM.create(holder,{
    value:digit,credits:false,
    view:{view:'flip',style:'flip-duration:450ms; rounded:none; shadow:none'},
   }));
  }
 }
 mount();reduced.addEventListener('change',mount);
 return {
  set(chapter){
   const next=String(chapter).padStart(2,'0');
   if(next===value)return; // Locale changes must not replay the animation.
   value=next;label.textContent=value;
   if(ticks.length!==value.length){mount();return;}
   ticks.forEach((tick,index)=>{if(tick.value!==value[index])tick.value=value[index];});
  },
  destroy(){reduced.removeEventListener('change',mount);ticks.forEach(tick=>Tick.DOM.destroy(tick.root));visual.remove();label.classList.remove('sr-only');},
 };
}
