// Six original notes, shared by the forward and retrograde readings.
export const CRAB_STORAGE='geb.crab.v1';
export const NOTE_COUNT=6;
export const DEFAULT_NOTES=[60,64,67,71,72,67];
export const PALETTE=[60,62,64,65,67,69,71,72];
export const CONSONANCES=new Set([0,3,4,7,8,9,12]);
export const MODES=['forward','reverse','together','explore'];
export const initialCrabState=()=>({version:1,stage:0,notes:[...DEFAULT_NOTES]});
export function validNotes(notes){return Array.isArray(notes)&&notes.length===NOTE_COUNT&&notes.every((n,i)=>PALETTE.includes(n)&&CONSONANCES.has(Math.abs(n-notes[NOTE_COUNT-1-i])));}
export function restoreCrabState(value){
  const fresh=initialCrabState();
  if(value?.version!==1||!Number.isInteger(value.stage)||value.stage<0||value.stage>3)return fresh;
  return {...fresh,stage:value.stage,notes:validNotes(value.notes)?[...value.notes]:fresh.notes};
}
export function advanceCrab(state){const value=restoreCrabState(state);value.stage=Math.min(3,value.stage+1);return value;}
export function cycleCrabNote(state,index){
  const value=restoreCrabState(state);if(!Number.isInteger(index)||index<0||index>=NOTE_COUNT)return value;
  const other=value.notes[NOTE_COUNT-1-index];
  const options=PALETTE.filter(note=>CONSONANCES.has(Math.abs(note-other)));
  value.notes[index]=options[(options.indexOf(value.notes[index])+1)%options.length];return value;
}
export function crabScore(notes,reverse=false){
  const events=notes.map((pitch,index)=>({pitch,index,beats:1}));return reverse?events.reverse():events;
}
export const crabDuration=mode=>mode==='together'||mode==='explore'?12:9;
export function crabFrame(mode,progress){
  const p=Math.max(0,Math.min(1,progress)),step=Math.min(NOTE_COUNT-1,Math.floor(p*NOTE_COUNT));
  const both=mode==='together'||mode==='explore';
  return {mode,progress:p,step,forward:both||mode==='forward'?step:null,reverse:both||mode==='reverse'?NOTE_COUNT-1-step:null,
    dialogue:both?Math.min(6,Math.floor(p*7)):Math.min(2,Math.floor(p*3))};
}
export function crabDialogue(mode,index){
  const both=mode==='together'||mode==='explore';
  if(both){if(index===3)return {actor:'crab',line:3};return {actor:index<3?(index%2?'tortoise':'achilles'):(index%2?'achilles':'tortoise'),line:index<3?index:6-index};}
  return mode==='reverse'?{actor:index%2?'achilles':'tortoise',line:2-index}:{actor:index%2?'tortoise':'achilles',line:index};
}
// Shared physical doorway in the gallery's right wall.
export const COURT_GATE={x:17,z:-10,halfWidth:1.6,top:2.6};
export const courtStop=index=>index===0?[22.9,-6.7]:[30.5,-6.8];
export function courtRoute(start,index,returning=false){
  const end=returning?(index===0?[-2.1,-7.1]:[-1.1,-6.6]):courtStop(index);
  return [start,...(returning?[[19,-10],[17,-10],[15,-10]]:[[15,-10],[17,-10],[19,-10]]),end];
}
