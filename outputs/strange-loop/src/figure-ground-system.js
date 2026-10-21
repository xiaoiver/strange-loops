export const FIGURE_STORAGE = 'geb.figure-ground.v1';
export const NUMBERS = Object.freeze(Array.from({ length: 11 }, (_, i) => i + 2));
export const INITIAL_PRODUCTS = Object.freeze([[2, 2], [2, 3], [3, 3]].map(Object.freeze));

export function trialDivision(number) {
  if (!Number.isSafeInteger(number) || number < 2 || number > 1e6) return null;
  const checks = [];
  for (let divisor = 2; divisor * divisor <= number; divisor++) {
    const remainder = number % divisor;
    checks.push({ divisor, remainder });
    if (remainder === 0) return { number, checks, prime: false };
  }
  return { number, checks, prime: true };
}

export function initialFigureState() {
  return { version: 1, ground: false, meaning: false, products: [], check: null, answer: null };
}

// Restore evidence, never trust a saved stage or an isolated completion flag.
export function restoreFigureState(saved) {
  const state = initialFigureState();
  if (saved?.version !== 1 || saved.ground !== true) return state;
  state.ground = true;
  if (saved.meaning !== true) return state;
  state.meaning = true;
  state.products = INITIAL_PRODUCTS.map(pair => [...pair]);
  if (!Array.isArray(saved.products) || !saved.products.some(pair => Array.isArray(pair) && pair.length === 2 && pair[0] === 2 && pair[1] === 4)) return state;
  state.products.push([2, 4]);
  const proof = trialDivision(11);
  if (JSON.stringify(saved.check) !== JSON.stringify(proof)) return state;
  state.check = proof;
  if (saved.answer === 'not-listed') state.answer = saved.answer;
  return state;
}

export function figureStage(state) {
  if (state.answer === 'not-listed' && state.check) return 'complete';
  if (state.check) return 'eleven';
  if (state.products.some(([a, b]) => a * b === 8)) return 'eight';
  if (state.meaning) return 'numbers';
  return state.ground ? 'ground' : 'faces';
}

export function advanceFigure(state, action) {
  const next = restoreFigureState(state), stage = figureStage(next);
  if (action === 'ground' && stage === 'faces') next.ground = true;
  if (action === 'meaning' && stage === 'ground') {
    next.meaning = true; next.products = INITIAL_PRODUCTS.map(pair => [...pair]);
  }
  if (action === 'generate' && stage === 'numbers') next.products.push([2, 4]);
  if (action === 'check' && stage === 'eight') next.check = trialDivision(11);
  if (action === 'not-listed' && stage === 'eleven') next.answer = action;
  return next;
}

export function numberEvidence(state, number) {
  const product = state.products.find(([a, b]) => a * b === number);
  if (product) return { kind: 'composite', product };
  if (state.check?.number === number && state.check.prime) return { kind: 'prime', checks: state.check.checks };
  return { kind: 'unclassified' };
}
