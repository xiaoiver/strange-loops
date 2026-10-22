// A finite recursive visit: each return resumes the room that was suspended.
export const LABYRINTH_STORAGE = 'geb.labyrinth.v1';
export const MAX_DEPTH = 2;
export const initialLabyrinthState = () => ({ version: 1, depth: 0, leafSeen: false, complete: false });
export function restoreLabyrinthState(saved) {
  const state = initialLabyrinthState();
  if (saved?.version !== 1 || !Number.isInteger(saved.depth) || saved.depth < 0 || saved.depth > MAX_DEPTH) return state;
  state.depth = saved.depth;
  state.leafSeen = saved.leafSeen === true || state.depth === MAX_DEPTH;
  state.complete = saved.complete === true && state.depth === 0 && state.leafSeen;
  return state;
}
export function advanceLabyrinth(value, action) {
  const state = restoreLabyrinthState(value);
  if (action === 'enter' && state.depth < MAX_DEPTH) {
    state.depth++;
    state.leafSeen ||= state.depth === MAX_DEPTH;
  } else if (action === 'return' && state.depth > 0) {
    state.depth--;
    state.complete = state.depth === 0 && state.leafSeen;
  } else if (action === 'again' && state.depth === 0) return initialLabyrinthState();
  return state;
}
export function labyrinthReading(state) {
  if (state.complete) return 'returned';
  if (state.depth === MAX_DEPTH) return 'leaf';
  return state.leafSeen ? 'resumed' : state.depth === 0 ? 'model' : 'inside';
}
