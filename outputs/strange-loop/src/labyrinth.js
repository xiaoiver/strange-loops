import { createLabyrinthMusic } from './labyrinth-music.js';
import { COPY } from './copy.js';
import { LABYRINTH_COPY } from './labyrinth-copy.js';
import { LABYRINTH_STORAGE, MAX_DEPTH, initialLabyrinthState, restoreLabyrinthState, advanceLabyrinth, labyrinthReading } from './labyrinth-system.js';

const MUSIC_PROMPT_STORAGE = 'geb.labyrinth.musicPrompt.v1';

function fallbackRooms(depth){
  // A diagram of the same three levels, available without WebGL or image downloads.
  return `<svg viewBox="0 0 640 400" role="presentation" aria-hidden="true"><g fill="none" stroke="currentColor">${[0,1,2].map(i=>{
    const width=510-i*130,height=300-i*78,x=60+i*65,y=45+i*39;
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" stroke-width="${i===depth?3:1}" opacity="${i===depth?1:.28}"/><path d="M${x+width*.35} ${y+height}v-30h${width*.3}v30" stroke-width="1"/>`;
  }).join('')}<circle cx="315" cy="195" r="18" stroke-width="2"/></g></svg>`;
}
function readMusicPromptState(){
  try{return sessionStorage.getItem(MUSIC_PROMPT_STORAGE);}catch{return 'dismissed';}
}
function writeMusicPromptState(value){
  try{sessionStorage.setItem(MUSIC_PROMPT_STORAGE,value);}catch{}
}
export function createLabyrinth(root,{locale:initialLocale,navigation,onMove,onBack,onMeet,onAnnounce}){
  let locale=initialLocale,state=initialLabyrinthState(),active=false,busy=false,revision=0,musicPromptOpen=false;
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
    const t=c(),reading=labyrinthReading(state),actor=reading==='inside'||reading==='leaf'?'tortoise':'achilles';
    const action=state.depth===MAX_DEPTH||state.leafSeen&&state.depth>0?'return':state.complete?'again':'enter';
    const retained=root.contains(document.activeElement)?document.activeElement.id:null;
    const showMusicPrompt=musicPromptOpen&&!musicPromptBlocked();
    root.setAttribute('aria-busy',String(busy));root.dataset.depth=state.depth;
    root.innerHTML=`<header class="labyrinth-heading"><p>${t.eyebrow}</p><h2 id="labyrinth-title" tabindex="-1">${t.title}</h2></header>
      <div class="labyrinth-reading"><p class="labyrinth-level">${t.location}<span>${t.levels[state.depth]}<small class="labyrinth-key"> · ${t.keys[state.depth]}</small></span></p>
      <p class="labyrinth-note">${state.depth===MAX_DEPTH?t.leafNote:state.leafSeen?t.returnNote:state.depth===1?t.foldNote:t.note}</p>
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
      <div class="labyrinth-fallback" aria-label="${t.fallback}">${fallbackRooms(state.depth)}</div>
      <div class="labyrinth-dialogue dialogue"><span class="speaker">${COPY[locale].actors[actor]}</span><p>${t[reading]}</p></div>
      <div class="labyrinth-action"><button id="labyrinth-primary" class="figure-primary" data-labyrinth="${action}" ${busy?'disabled':''}>${action==='enter'&&state.depth===1?t.unfold:t[action]} <span aria-hidden="true">${action==='return'?'←':'→'}</span></button>
      ${state.depth===1&&!state.leafSeen?`<button id="labyrinth-return" class="figure-link" data-labyrinth="return" ${busy?'disabled':''}>← ${t.return}</button>`:''}</div>
      <dialog class="garden-dialog" id="labyrinth-preview"><h3>${t.preview}</h3><button data-labyrinth="close">${t.close}</button></dialog>`;
    syncMusic();
    if(active){
      navigation.innerHTML=`<button id="labyrinth-back" data-labyrinth="back">${t.back}</button><button id="labyrinth-next" data-labyrinth="next">${t.next}</button>`;
      if(focus||retained)root.querySelector(`#${focus||retained}`)?.focus({preventScroll:true});
      if(previewOpen)root.querySelector('dialog').showModal();
    }
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
    if(busy)return;
    const beforeDepth=state.depth;
    const next=advanceLabyrinth(state,action);if(JSON.stringify(state)===JSON.stringify(next))return;
    music.gesture();
    if(action==='again')music.reset(0);else music.move(next.depth);
    state=next;save();
    if(action==='again'){render('labyrinth-primary');onAnnounce(c()[labyrinthReading(state)]);return;}
    busy=true;const token=++revision;render();
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
    talk(id){onMeet(id);onAnnounce(c()[labyrinthReading(state)]);},
    retreat(){if(busy)return true;if(state.depth===0)return false;handle({target:{closest:()=>({dataset:{labyrinth:'return'}})}});return true;},
  };
}
