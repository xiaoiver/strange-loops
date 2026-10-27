export const FIGURE_STORAGE = 'geb.figure-ground.v1';

export function initialFigureState() {
  return { version: 6, posters: false, marks: false, ground: false, observed: false };
}

// Preserve observed artwork across older tours. Retired number-wall fields
// never select a camera, restore a question, or mark this gallery complete.
export function restoreFigureState(saved) {
  const state = initialFigureState();
  if (![1, 2, 3, 4, 5, 6].includes(saved?.version)) return state;
  state.posters = saved.version === 1 ? saved.meaning === true : saved.posters === true;
  state.marks = saved.version < 6 ? state.posters : saved.marks === true;
  state.ground = saved.ground === true;
  state.observed = saved.observed === true;
  return state;
}

export function figureStage(state) {
  return !state.posters ? 'posters' : !state.marks ? 'marks' : state.ground ? 'ground' : 'faces';
}

export function advanceFigure(state, action) {
  const next = restoreFigureState(state), stage = figureStage(next);
  if (action === 'to-wall' && stage === 'posters') next.posters = true;
  if (action === 'to-contour') { next.posters = true; next.marks = true; }
  if (action === 'ground' && stage === 'faces') next.ground = true;
  return next;
}

export function figureLocation(state,{poster=false,fedex=false}={}) {
  if(poster)return 'poster';
  if(fedex)return 'fedex';
  const stage=figureStage(restoreFigureState(state));
  return stage==='posters'?'poster':stage==='marks'?'fedex':'contour';
}

export function figureNavigation(state,options={}) {
  const location=figureLocation(state,options);
  return {primary:location==='poster'?'fedex':location==='fedex'?'arrow':figureStage(state)==='faces'?'ground':'next',
    next:location==='contour'?'next':'to-contour'};
}
