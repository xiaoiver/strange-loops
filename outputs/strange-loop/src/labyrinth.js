import { createLabyrinthMusic } from './labyrinth-music.js';
import { COPY } from './copy.js';
import { mengerDiagram } from './menger-architecture.js';
import { LABYRINTH_COPY } from './labyrinth-copy.js';
import { LABYRINTH_STORAGE, initialLabyrinthState, restoreLabyrinthState, advanceLabyrinth, labyrinthReading } from './labyrinth-system.js';

const MUSIC_PROMPT_STORAGE = 'geb.labyrinth.musicPrompt.v1';

function readMusicPromptState(){
  try{return sessionStorage.getItem(MUSIC_PROMPT_STORAGE);}catch{return 'dismissed';}
}
function writeMusicPromptState(value){
  try{sessionStorage.setItem(MUSIC_PROMPT_STORAGE,value);}catch{}
}
export function createLabyrinth(root,{locale:initialLocale,navigation,onMove,onTravel=()=>{},onStep=()=>{},onBack,onMeet,onAnnounce}){
  let locale=initialLocale,state=initialLabyrinthState(),active=false,busy=false,revision=0,musicPromptOpen=false,travel={moving:false,entering:false,returning:false,reduced:false};
  try{state=restoreLabyrinthState(JSON.parse(localStorage.getItem(LABYRINTH_STORAGE)));}catch{}
  const c=()=>LABYRINTH_COPY[locale];
  const music=createLabyrinthMusic({onChange:()=>syncMusic()});
  function musicPromptBlocked(){
    const sound=music.state();
    return !sound.available||sound.started||readMusicPromptState()!=='';
  }
  function closeMusicPrompt(){
    musicPromptOpen=false;writeMusicPromptState('dismissed');
  }
  function maybeOpenMusicPrompt(fromDepth){
    if(musicPromptBlocked())return;
    if(fromDepth===0&&state.depth>=1)musicPromptOpen=true;
    else if(state.depth>=1&&!musicPromptOpen&&readMusicPromptState()==='')musicPromptOpen=true;
  }
  function syncMusic(){
    const button=root.querySelector('#labyrinth-music');if(!button)return;
    const sound=music.state(),t=c();
    button.textContent=!sound.available?t.musicUnavailable:sound.enabled&&sound.started?t.musicMute:t.musicStart;
    button.disabled=!sound.available;button.setAttribute('aria-pressed',String(sound.enabled&&sound.started));
    button.title=t.musicHint;
    const prompt=root.querySelector('#labyrinth-music-prompt');
    if(prompt)prompt.hidden=!musicPromptOpen||musicPromptBlocked();
  }
  document.addEventListener('visibilitychange',()=>music.setForeground(!document.hidden));
  window.addEventListener('pagehide',()=>music.stop());
  function render(focus){
    const previewOpen=root.querySelector('dialog')?.open;
    const t=c(),reading=labyrinthReading(state),actor=state.depth?'tortoise':'achilles';
    const fallback=document.body.dataset.scene==='fallback';
    const action=state.depth?(fallback?'return':'travel'):'enter';
    const retained=root.contains(document.activeElement)?document.activeElement.id:null;
    const showMusicPrompt=musicPromptOpen&&!musicPromptBlocked();
    root.setAttribute('aria-busy',String(busy));root.dataset.depth=state.depth;
    root.innerHTML=`<header class="labyrinth-heading"><p>${t.eyebrow}</p><h2 id="labyrinth-title" tabindex="-1">${t.title}</h2></header>
      <div class="labyrinth-reading"><p class="labyrinth-level">${t.location}<span>${t.levels[state.depth]}<small class="labyrinth-key"> · ${t.keys[state.depth]}</small></span></p>
      <p class="labyrinth-note">${state.depth?t.foldNote:state.complete?t.returnNote:t.note}</p>
      <div class="labyrinth-music-wrap">
        <button id="labyrinth-music" class="labyrinth-music" data-labyrinth="music" aria-pressed="false"></button>
        <aside id="labyrinth-music-prompt" class="labyrinth-music-prompt" ${showMusicPrompt?'':'hidden'}>
          <p>${t.musicPrompt}</p>
          <div class="labyrinth-music-prompt-actions">
            <button type="button" class="labyrinth-music-prompt-enable" data-labyrinth="music">${t.musicStart}</button>
            <button type="button" class="labyrinth-music-prompt-dismiss" data-labyrinth="music-prompt-dismiss">${t.musicPromptDismiss}</button>
          </div>
        </aside>
      </div></div>
      <div class="labyrinth-fallback" aria-label="${t.fallback}">${mengerDiagram(state.depth)}</div>
      <div class="labyrinth-dialogue dialogue"><span class="speaker">${COPY[locale].actors[actor]}</span><p>${t[reading]}</p></div>
      <div class="labyrinth-action"><button id="labyrinth-primary" class="figure-primary" data-labyrinth="${action}"></button>
      ${state.depth&&!fallback?`<button id="labyrinth-return" class="figure-link" data-labyrinth="return">← ${t.returnOuter}</button>`:''}</div>
      <dialog class="garden-dialog" id="labyrinth-preview"><h3>${t.preview}</h3><button data-labyrinth="close">${t.close}</button></dialog>`;
    syncMusic();syncTravel();
    if(active){
      navigation.innerHTML=`<button id="labyrinth-back" data-labyrinth="back">${t.back}</button><button id="labyrinth-next" data-labyrinth="next">${t.next}</button>`;
      if(focus||retained)root.querySelector(`#${focus||retained}`)?.focus({preventScroll:true});
      if(previewOpen)root.querySelector('dialog').showModal();
    }
  }
  function syncTravel(){
    const button=root.querySelector('#labyrinth-primary');if(!button)return;
    const t=c(),fallback=document.body.dataset.scene==='fallback';
    button.disabled=travel.returning;
    const label=state.depth?(fallback?t.returnOuter:travel.reduced?t.step:travel.moving?t.pause:t.roam):state.complete?t.again:t.enter;
    button.innerHTML=label+' <span aria-hidden="true">'+(state.depth&&travel.moving?'Ⅱ':'→')+'</span>';
    const back=root.querySelector('#labyrinth-return');if(back)back.disabled=travel.returning;
    const place=root.querySelector('.labyrinth-level span');if(place){const label=travel.returning?t.returning:state.depth&&travel.entering&&!travel.inside?t.entering:t.levels[state.depth];place.innerHTML=label+'<small class="labyrinth-key"> · '+t.keys[state.depth]+'</small>';}
    root.dataset.moving=String(travel.moving);root.dataset.interior=String(travel.inside===true);
  }
  function save(){try{localStorage.setItem(LABYRINTH_STORAGE,JSON.stringify(state));}catch{}}
  function handle(event){
    if(!active)return;
    const action=event.target.closest('[data-labyrinth]')?.dataset.labyrinth;
    if(!action)return;
    if(action==='back'){music.stop();onBack();return;}
    if(action==='music-prompt-dismiss'){closeMusicPrompt();render();return;}
    if(action==='music'){
      if(!music.state().started&&music.state().enabled)music.gesture();else music.toggle();
      if(music.state().enabled)writeMusicPromptState('engaged');
      closeMusicPrompt();
      return;
    }
    if(action==='next'){root.querySelector('dialog').showModal();return;}
    if(action==='close'){root.querySelector('dialog').close();navigation.querySelector('#labyrinth-next')?.focus();return;}
    if(action==='travel'){if(travel.reduced)onStep();else onTravel();return;}
    if(busy&&action!=='return')return;
    const beforeDepth=state.depth;
    const next=advanceLabyrinth(state,action);if(JSON.stringify(state)===JSON.stringify(next))return;
    music.gesture();
    if(action==='again')music.reset(0);else music.move(next.depth);
    state=next;save();
    busy=true;const token=++revision;render();onAnnounce(action==='return'?c().returning:c().entering);
    onMove(state.depth,()=>{if(!active||revision!==token)return;music.arrive();busy=false;maybeOpenMusicPrompt(beforeDepth);render('labyrinth-primary');onAnnounce(c()[labyrinthReading(state)]);});
  }
  root.addEventListener('click',handle);navigation.addEventListener('click',handle);
  return {
    show(){
      music.reset(state.depth,state);music.setForeground(!document.hidden);active=true;busy=false;root.hidden=false;
      maybeOpenMusicPrompt(-1);render('labyrinth-title');onAnnounce(c()[labyrinthReading(state)]);
    },
    stopMusic(){music.stop();},
    hide(){music.stop();active=false;revision++;busy=false;musicPromptOpen=false;root.querySelector('dialog')?.close();root.hidden=true;},
    setLocale(value){locale=value;if(active)render();},
    getState:()=>state,
    arriveOutside(){state=advanceLabyrinth(state,'return');save();},
    setTravelState(value){travel=value;if(active)syncTravel();},
    talk(id){onMeet(id);onAnnounce(c()[labyrinthReading(state)]);},
    retreat(){if(travel.returning)return true;if(state.depth===0)return false;handle({target:{closest:()=>({dataset:{labyrinth:'return'}})}});return true;},
  };
}
