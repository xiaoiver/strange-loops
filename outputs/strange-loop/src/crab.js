import {COPY} from './copy.js';
import {CRAB_COPY} from './crab-copy.js';
import {CRAB_STORAGE,MODES,initialCrabState,restoreCrabState,advanceCrab,cycleCrabNote,crabFrame,crabDuration,crabDialogue} from './crab-system.js';
import {createCrabAudio} from './crab-audio.js';

export function createCrab(root,{locale:initialLocale,navigation,reduced,onStage,onFrame,onBack,onMeet,onAnnounce}){
 let locale=initialLocale,state=initialCrabState(),active=false,playing=false,elapsed=0,last=0,raf=null,run=0,lastCaption='',currentFrame=crabFrame('forward',0);
 try{state=restoreCrabState(JSON.parse(localStorage.getItem(CRAB_STORAGE)));}catch{}
 const c=()=>CRAB_COPY[locale],mode=()=>MODES[state.stage];
 const audio=createCrabAudio({onChange:()=>syncSound()});
 const actorName=id=>id==='crab'?c().crab:COPY[locale].actors[id];
 function save(){try{localStorage.setItem(CRAB_STORAGE,JSON.stringify(state));}catch{}}
 function syncSound(){const button=root.querySelector('#crab-music');if(!button)return;const sound=audio.state();button.textContent=!sound.available?c().musicUnavailable:sound.enabled?c().musicOff:c().musicOn;button.setAttribute('aria-pressed',String(sound.enabled));button.disabled=!sound.available;button.title=c().musicHint;}
 function stop(){playing=false;run++;if(raf!==null)cancelAnimationFrame(raf);raf=null;audio.setActive(false);}
 function caption(frame,announce=false){
  const line=crabDialogue(frame.mode,frame.dialogue),key=`${frame.mode}:${frame.dialogue}:${locale}`;
  const element=root.querySelector('.crab-dialogue');if(!element)return;
  if(lastCaption!==key){element.querySelector('.speaker').textContent=actorName(line.actor);element.querySelector('p').textContent=c().lines[line.line];lastCaption=key;if(announce)onAnnounce(c().lines[line.line]);}
 }
 function display(frame){
  currentFrame=frame;onFrame(frame,state.notes,playing);caption(frame,playing);
  const position=reduced.matches?frame.step/5:Math.min(5,frame.progress*6)/5;
  root.dataset.mode=frame.mode;root.style.setProperty('--forward-position',String(position));root.style.setProperty('--reverse-position',String(1-position));
  for(const node of root.querySelectorAll('[data-note]')){const i=Number(node.dataset.note);node.dataset.forward=String(playing&&frame.forward===i);node.dataset.reverse=String(playing&&frame.reverse===i);}
  root.querySelector('.crab-fallback')?.setAttribute('aria-label',c().fallback);
 }
 function render(focus){
  const t=c(),retained=root.contains(document.activeElement)?document.activeElement.id:null,detailsOpen=root.querySelector('details')?.open;
  root.innerHTML=`<header class="crab-heading"><p>${t.eyebrow}</p><h2 id="crab-title" tabindex="-1">${t.title}</h2></header>
   <div class="crab-reading"><p class="crab-stage">${t.stages[state.stage]}</p><p>${t.notes[state.stage]}</p><button id="crab-music" class="labyrinth-music" data-crab="music" aria-pressed="false"></button></div>
   <div class="crab-fallback" role="img" aria-label="${t.fallback}"><div class="crab-fallback-track"><i class="crab-marker-forward"></i><i class="crab-marker-reverse"></i>${state.notes.map((note,i)=>`<span style="--note-height:${20+(note-60)*3}px" data-fallback-note="${i}"></span>`).join('')}</div></div>
   <p class="crab-legend"><span>${t.forward}</span><span>${t.reverse}</span></p>
   <div class="dialogue crab-dialogue"><span class="speaker"></span><p></p></div>
   <div class="crab-action"><button class="figure-primary" id="crab-primary" data-crab="play">${playing?t.continue:t.actions[state.stage]} <span aria-hidden="true">→</span></button></div>
   ${state.stage===3?`<div class="crab-explore"><div class="crab-note-buttons">${state.notes.map((note,i)=>`<button id="crab-note-${i}" data-note="${i}" aria-label="${t.noteLabel} ${i+1}" style="--note-height:${10+(note-60)*1.3}px"><i aria-hidden="true"></i><span aria-hidden="true">${String(i+1).padStart(2,'0')}</span></button>`).join('')}</div><div class="crab-explore-actions"><button class="figure-link" data-crab="reset">${t.reset}</button><button class="figure-link" data-crab="restart">${t.restart}</button></div><details ${detailsOpen?'open':''}><summary>${t.comparison}</summary><ol>${Array.from({length:7},(_,i)=>{const d=crabDialogue('together',i);return `<li><span>${actorName(d.actor)}</span>${t.lines[d.line]}</li>`;}).join('')}</ol></details></div>`:''}
   <dialog class="garden-dialog" id="crab-preview"><h3>${t.preview}</h3><button data-crab="close">${t.close}</button></dialog>`;
  navigation.innerHTML=`<button id="crab-back" data-crab="back">${t.back}</button><button id="crab-next" data-crab="next">${t.next}</button>`;
  syncSound();lastCaption='';display(playing?currentFrame:crabFrame(mode(),0));
  if(focus||retained)root.querySelector(`#${focus||retained}`)?.focus({preventScroll:true});
 }
 function finish(){
  stop();if(state.stage<3)state=advanceCrab(state);save();render('crab-primary');onAnnounce(c().notes[state.stage]);
 }
 function tick(time){
  raf=null;if(!active||!playing||document.hidden)return;
  const dt=Math.min(.1,Math.max(0,(time-last)/1000));last=time;elapsed+=dt;
  const p=Math.min(1,elapsed/crabDuration(mode())),frame=crabFrame(mode(),p);display(frame);
  audio.frame(frame,state.notes,crabDuration(mode())/6,`${run}:${frame.step}`);
  if(p===1){finish();return;}raf=requestAnimationFrame(tick);
 }
 function play(){
  stop();playing=true;elapsed=0;last=performance.now();onStage(mode());currentFrame=crabFrame(mode(),0);render('crab-primary');audio.setActive(true);audio.frame(currentFrame,state.notes,crabDuration(mode())/6,`${run}:0`);raf=requestAnimationFrame(tick);
 }
 function changeNote(index){if(!active||state.stage!==3)return;stop();state=cycleCrabNote(state,index);save();render(`crab-note-${index}`);onFrame(crabFrame('explore',0),state.notes,false);onAnnounce(c().changed);}
 function handle(event){
  if(!active)return;const note=event.target.closest('[data-note]');if(note){changeNote(Number(note.dataset.note));return;}
  const action=event.target.closest('[data-crab]')?.dataset.crab;
  if(action==='play'){if(playing)finish();else play();}
  else if(action==='music')audio.toggle();
  else if(action==='back'){stop();onBack();}
  else if(action==='next'){stop();render('crab-primary');root.querySelector('dialog').showModal();}
  else if(action==='close'){root.querySelector('dialog').close();navigation.querySelector('#crab-next')?.focus();}
  else if(action==='reset'){stop();state.notes=initialCrabState().notes;save();render('crab-primary');}
  else if(action==='restart'){stop();state=initialCrabState();save();onStage(mode());render('crab-primary');onAnnounce(c().notes[0]);}
 }
 root.addEventListener('click',handle);navigation.addEventListener('click',handle);
 document.addEventListener('visibilitychange',()=>{if(!active||!playing)return;if(document.hidden){if(raf!==null)cancelAnimationFrame(raf);raf=null;audio.setActive(false);}else{last=performance.now();audio.setActive(true);audio.frame(currentFrame,state.notes,crabDuration(mode())/6,`${run}:${currentFrame.step}`);raf=requestAnimationFrame(tick);}});
 window.addEventListener('pagehide',stop);
 return {
  show(){active=true;root.hidden=false;render('crab-title');onStage(mode(),true);onAnnounce(c().notes[state.stage]);},
  hide(){stop();active=false;root.querySelector('dialog')?.close();root.hidden=true;},
  setLocale(value){locale=value;if(active){const open=root.querySelector('dialog')?.open;render();if(open)root.querySelector('dialog').showModal();}},
  talk(id){onMeet(id);onAnnounce(c().lines[crabDialogue(mode(),currentFrame.dialogue).line]);},
  changeNote,
  dismiss(){if(playing){finish();return true;}const details=root.querySelector('details[open]');if(details){details.open=false;return true;}return false;},
  getState:()=>state,
 };
}
