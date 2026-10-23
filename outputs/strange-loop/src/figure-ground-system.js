export const FIGURE_STORAGE = 'geb.figure-ground.v1';

export function initialFigureState() {
  return { version: 5, posters: false, ground: false, observed: false };
}

// Preserve observed artwork across older tours. Retired number-wall fields
// never select a camera, restore a question, or mark this gallery complete.
export function restoreFigureState(saved) {
  const state = initialFigureState();
  if (![1, 2, 3, 4, 5].includes(saved?.version)) return state;
  state.posters = saved.version === 1 ? saved.meaning === true : saved.posters === true;
  state.ground = saved.ground === true;
  state.observed = saved.observed === true;
  return state;
}

export function figureStage(state) {
  return !state.posters ? 'posters' : state.ground ? 'ground' : 'faces';
}

export function advanceFigure(state, action) {
  const next = restoreFigureState(state), stage = figureStage(next);
  if (action === 'to-contour' && stage === 'posters') next.posters = true;
  if (action === 'ground' && stage === 'faces') next.ground = true;
  return next;
}
