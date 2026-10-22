// Original miniature for this exhibition. Pitches are MIDI; no recordings or samples.
export const ROOM_KEYS = ['C', 'G', 'D'];
const chord = (notes, beats=1, melody=null) => ({notes, beats, melody});
// The shared C chord pivots from I in C to IV in G; G pivots from I in G to IV in D.
// F# in D7 establishes G, C# in A7 establishes D. Returning restores F natural via G7.
export const ROOM_SCORES = [
  { opening: [chord([48,55,64],1,72),chord([48,55,64],1,76),chord([53,60,69],1,77),chord([43,59,65],1.5,74)],
    continuation: [chord([57,60,65],1,77),chord([43,59,65],1,74),chord([48,55,64],2.5,72)] },
  { opening: [chord([43,55,62],1,71),chord([47,55,62],1,74),chord([48,55,64],1,76),chord([50,57,60,66],1.5,69)],
    continuation: [chord([48,55,64],1,72),chord([50,57,60,66],1,69),chord([43,55,59,62],2.5,67)] },
  { opening: [chord([50,57,66],1,74),chord([55,62,71],1,79),chord([45,55,61,64],1,76),chord([50,57,66],2.5,74)], continuation: [] },
];
export function modulation(from,to) {
  if(to>from)return to===1
    ? [chord([48,55,64],1,76),chord([50,57,60,66],1,78),chord([43,55,59,62],1,79)]
    : [chord([43,55,62],1,74),chord([45,55,61,64],1,73),chord([50,57,66],1,74)];
  return to===1
    ? [chord([50,57,60,66],1,78),chord([43,55,59,62],1,79)]
    : [chord([43,59,65],1,77),chord([48,55,64],1,76)];
}
const BEAT = .46;
const frame = (depth, suspended=false) => ({depth, index:suspended?ROOM_SCORES[depth].opening.length:0, returning:false});
export function createLabyrinthMusic({contextFactory=()=>new (window.AudioContext||window.webkitAudioContext)(), setTimer=setTimeout, clearTimer=clearTimeout, enabled=false, onChange=()=>{}}={}) {
  let context=null, timer=null, frames=[frame(0)], travel=[], travelIndex=0, arriving=false;
  let active=false, foreground=true, available=true, allowed=enabled, unlocked=false, revision=0;
  const voices=new Set();
  const current=()=>frames.at(-1);
  function state(){return {enabled:allowed, available, started:active&&unlocked, depth:current().depth, key:ROOM_KEYS[current().depth]};}
  function notify(){onChange(state());}
  function cancel(){
    if(timer!==null)clearTimer(timer);timer=null;
    for(const voice of voices){
      const now=context.currentTime;voice.gain.gain.cancelScheduledValues(now);voice.gain.gain.setTargetAtTime(.0001,now,.012);
      try{voice.osc.stop(now+.055);}catch{}
    }
  }
  function tone(pitch,start,duration,level,type){
    const osc=context.createOscillator(),gain=context.createGain(),voice={osc,gain};voices.add(voice);
    osc.type=type;osc.frequency.setValueAtTime(440*2**((pitch-69)/12),start);
    gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(level,start+.025);
    gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    osc.connect(gain);gain.connect(context.destination);
    osc.onended=()=>{osc.disconnect();gain.disconnect();voices.delete(voice);};
    osc.start(start);osc.stop(start+duration+.03);
  }
  function sound(event){
    const start=context.currentTime+.015,duration=event.beats*BEAT;
    for(const note of event.notes)tone(note,start,Math.max(.2,duration*.96),.055/event.notes.length,'sine');
    if(event.melody!==null)tone(event.melody,start,Math.max(.2,duration*.85),.045,'triangle');
  }
  function pump(){
    if(timer!==null||!active||!foreground||!allowed||!unlocked||context?.state!=='running')return;
    let event;
    if(travelIndex<travel.length)event=travel[travelIndex++];
    else {
      if(arriving)return;
      const f=current(),score=ROOM_SCORES[f.depth];
      const notes=f.returning?[...score.opening,...score.continuation]:score.opening;
      event=notes[f.index];if(!event)return;f.index++;
    }
    sound(event);
    const token=revision;
    timer=setTimer(()=>{timer=null;if(token===revision)pump();},event.beats*BEAT*1000);
  }
  function unlock(){
    if(!active||!foreground||!allowed||!available)return;
    const token=revision;
    try{
      context??=contextFactory();
      // Call resume directly inside the gesture, including when a previous resume is pending.
      Promise.resolve(context.resume()).then(()=>{if(token!==revision||!active||!allowed||!foreground)return;unlocked=true;notify();pump();},()=>{if(token===revision){available=false;cancel();notify();}});
    }catch{available=false;cancel();notify();}
  }
  return {
    state,
    reset(depth=0,{leafSeen=false,complete=false}={}){
      revision++;cancel();active=false;travel=[];travelIndex=0;arriving=false;
      frames=Array.from({length:depth+1},(_,i)=>frame(i,i<depth));
      if(leafSeen&&depth<2){current().returning=true;current().index=ROOM_SCORES[depth].opening.length;}
      if(complete)current().index=ROOM_SCORES[0].opening.length+ROOM_SCORES[0].continuation.length;
      notify();
    },
    gesture(){active=true;unlock();},
    move(depth){
      const from=current().depth;revision++;cancel();
      const pickup=depth>from&&current().index===0?ROOM_SCORES[from].opening.slice(0,2):[];
      if(pickup.length)current().index=pickup.length;
      if(depth>from)frames.push(frame(depth));
      else {frames=frames.slice(0,depth+1);current().returning=true;}
      travel=[...pickup,...modulation(from,depth)];travelIndex=0;arriving=true;notify();
      // A fresh resume binds the current score revision to this user gesture.
      unlock();
    },
    arrive(){arriving=false;pump();},
    toggle(){allowed=!allowed;revision++;cancel();notify();if(allowed){active=true;unlock();}},
    stop(){active=false;revision++;cancel();},
    setForeground(value){foreground=value;revision++;cancel();if(value&&active)unlock();},
  };
}
