// A visitor may keep exploring the repeated field and choose when to return.
// Saves record the chapter visit, never an unbounded distance or camera rail.
export const LABYRINTH_STORAGE='geb.labyrinth.v1';
export const MAX_DEPTH=1;
export const initialLabyrinthState=()=>({version:2,depth:0,visited:false,complete:false});
export function restoreLabyrinthState(saved){
  const state=initialLabyrinthState();
  if(![1,2].includes(saved?.version)||!Number.isInteger(saved.depth)||saved.depth<0||saved.depth>(saved.version===1?2:1))return state;
  state.depth=Math.min(saved.depth,1);
  state.visited=state.depth===1||(saved.version===1?saved.leafSeen===true:saved.visited===true);
  state.complete=saved.complete===true&&state.depth===0&&state.visited;
  return state;
}
export function advanceLabyrinth(value,action){
  const state=restoreLabyrinthState(value);
  if((action==='enter'||action==='again')&&state.depth===0){state.depth=1;state.visited=true;state.complete=false;}
  else if(action==='return'&&state.depth===1){state.depth=0;state.complete=state.visited;}
  return state;
}
export function labyrinthReading(state){return state.depth===1?'inside':state.complete?'returned':'model';}
