// The language of the engine is always MIU. WJU is a presentation choice.
export const AXIOM = 'MI';
export const DISPLAY_LIMIT = 192;
export const HISTORY_LIMIT = 600;
export const displayWord = (word, locale) => locale === 'zh' ? word.replaceAll('M', 'W').replaceAll('I', 'J') : word;

export function occurrences(word, rule) {
  if (!/^M[IU]*$/.test(word)) return [];
  if (rule === 1) return word.endsWith('I') ? [word.length - 1] : [];
  if (rule === 2) return [0];
  const pattern = rule === 3 ? 'III' : rule === 4 ? 'UU' : null;
  if (!pattern) return [];
  const found = [];
  for (let i = 1; i <= word.length - pattern.length; i++) {
    if (word.startsWith(pattern, i)) found.push(i);
  }
  return found;
}

export function rewrite(word, rule, position) {
  if (!occurrences(word, rule).includes(position)) throw new Error('Invalid rewrite');
  if (rule === 1) return word + 'U';
  if (rule === 2) return 'M' + word.slice(1).repeat(2);
  if (rule === 3) return word.slice(0, position) + 'U' + word.slice(position + 3);
  return word.slice(0, position) + word.slice(position + 2);
}

// The source fragment affected by a legal rewrite, before locale substitution.
export function rewriteRange(word, rule, position) {
  if (!occurrences(word, rule).includes(position)) return null;
  if (rule === 2) return { start: 1, length: word.length - 1 };
  return { start: position, length: rule === 3 ? 3 : rule === 4 ? 2 : 1 };
}

// Keep visual motion tied to the same legal rewrite as the game.
// -1 marks a newly introduced letter; other entries refer to old character indices.
export function rewriteSources(word, rule, position) {
  rewrite(word, rule, position);
  const indices = Array.from(word, (_, i) => i);
  if (rule === 1) return [...indices, -1];
  if (rule === 2) return [...indices, ...indices.slice(1)];
  if (rule === 3) return [...indices.slice(0, position), -1, ...indices.slice(position + 3)];
  return [...indices.slice(0, position), ...indices.slice(position + 2)];
}

export function createHistory() {
  return { current: 0, nodes: [{ id: 0, parent: null, word: AXIOM, rule: null, position: null }] };
}

export function appendStep(history, rule, position) {
  const parent = history.nodes[history.current];
  if (!parent) throw new Error('Invalid parent');
  const word = rewrite(parent.word, rule, position);
  if (word.length > DISPLAY_LIMIT) throw new Error('display-limit');
  const existing = history.nodes.find(n => n.parent === parent.id && n.rule === rule && n.position === position);
  if (existing) { history.current = existing.id; return existing; }
  if (history.nodes.length >= HISTORY_LIMIT) throw new Error('history-limit');
  const node = { id: history.nodes.length, parent: parent.id, word, rule, position };
  history.nodes.push(node);
  history.current = node.id;
  return node;
}

export function pathTo(history, id = history.current) {
  const path = [];
  for (let node = history.nodes[id]; node; node = history.nodes[node.parent]) path.unshift(node);
  return path;
}

// Revalidate every edge on restore; storage is neither trusted nor a proof.
export function restoreHistory(value) {
  if (!value || !Array.isArray(value.nodes) || value.nodes.length < 1 || value.nodes.length > HISTORY_LIMIT) return createHistory();
  try {
    const nodes = value.nodes.map((n, i) => {
      if (n.id !== i || typeof n.word !== 'string' || n.word.length > DISPLAY_LIMIT) throw Error();
      if (i === 0) {
        if (n.word !== AXIOM || n.parent !== null) throw Error();
      } else {
        if (!Number.isInteger(n.parent) || n.parent < 0 || n.parent >= i ||
          rewrite(value.nodes[n.parent].word, n.rule, n.position) !== n.word) throw Error();
      }
      return { id: i, parent: n.parent, word: n.word, rule: n.rule, position: n.position };
    });
    if (!Number.isInteger(value.current) || !nodes[value.current]) throw Error();
    return { nodes, current: value.current };
  } catch { return createHistory(); }
}
