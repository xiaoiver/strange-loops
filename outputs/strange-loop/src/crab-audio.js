// Re-articulate note events in reverse order. No reversed recordings or sample downloads.
export function createCrabAudio({contextFactory=()=>new (window.AudioContext||window.webkitAudioContext)(),onChange=()=>{}}={}){
 let context=null,enabled=false,available=true,active=false,revision=0,latest=null,lastStamp=null;
 const voices=new Set();
 const state=()=>({enabled,available});
 function fade(){
  for(const voice of voices){const now=context.currentTime;voice.gain.gain.cancelScheduledValues(now);voice.gain.gain.setTargetAtTime(.0001,now,.012);try{voice.osc.stop(now+.06);}catch{}}
 }
 function tone(pitch,duration,reverse){
  const start=context.currentTime+.015;
  for(const harmonic of [1,2]){
   const osc=context.createOscillator(),gain=context.createGain(),pan=context.createStereoPanner?.(),voice={osc,gain};voices.add(voice);
   osc.type=reverse?'sine':'triangle';osc.frequency.setValueAtTime(440*2**((pitch-69)/12)*harmonic,start);
   gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(harmonic===1?.035:.008,start+.035);
   gain.gain.exponentialRampToValueAtTime(.0001,start+duration*.94);
   osc.connect(gain);if(pan){pan.pan.value=reverse?.32:-.32;gain.connect(pan);pan.connect(context.destination);}else gain.connect(context.destination);
   osc.onended=()=>{osc.disconnect();gain.disconnect();pan?.disconnect();voices.delete(voice);};osc.start(start);osc.stop(start+duration);
  }
 }
 function pump(){
  if(!enabled||!available||!active||!latest||context?.state!=='running'||latest.stamp===lastStamp)return;
  lastStamp=latest.stamp;fade();
  if(latest.frame.forward!==null)tone(latest.notes[latest.frame.forward],latest.duration,false);
  if(latest.frame.reverse!==null)tone(latest.notes[latest.frame.reverse],latest.duration,true);
 }
 function unlock(){
  if(!enabled||!active||!available)return;
  const token=revision;
  try{context??=contextFactory();Promise.resolve(context.resume()).then(()=>{if(token===revision&&active&&enabled)pump();},()=>{if(token===revision){available=false;fade();onChange(state());}});}
  catch{available=false;fade();onChange(state());}
 }
 return {
  state,
  toggle(){enabled=!enabled;revision++;fade();lastStamp=null;onChange(state());if(enabled)unlock();},
  setActive(value){active=value;if(!value){revision++;fade();latest=null;lastStamp=null;}else unlock();},
  frame(frame,notes,duration,stamp){latest={frame,notes,duration,stamp};pump();},
 };
}
