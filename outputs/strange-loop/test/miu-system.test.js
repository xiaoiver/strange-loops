import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewrite, rewriteSources, occurrences, createHistory, appendStep, pathTo, restoreHistory, displayWord, DISPLAY_LIMIT, HISTORY_LIMIT } from '../src/miu-system.js';

test('3D letter motion follows the exact rewrite, including duplicated and removed letters', () => {
  assert.deepEqual(rewriteSources('MII', 2, 0), [0, 1, 2, 1, 2]);
  assert.deepEqual(rewriteSources('MIIIIU', 3, 2), [0, 1, -1, 5]);
  assert.deepEqual(rewriteSources('MIUU', 4, 2), [0, 1]);
  assert.deepEqual(rewriteSources('MI', 1, 1), [0, 1, -1]);
  for (const word of ['MI', 'MIIIIU', 'MIIUU', 'MUIUI']) {
    for (const rule of [1, 2, 3, 4]) {
      for (const position of occurrences(word, rule)) {
        const sources = rewriteSources(word, rule, position);
        assert.equal(sources.map(i => i === -1 ? 'U' : word[i]).join(''), rewrite(word, rule, position));
      }
    }
  }
  assert.throws(() => rewriteSources('MI', 4, 1));
});

test('all four rules preserve the prefix and rewrite exactly one occurrence', () => {
  assert.equal(rewrite('MI', 1, 1), 'MIU');
  assert.equal(rewrite('MIU', 2, 0), 'MIUIU');
  assert.equal(rewrite('MIIII', 3, 1), 'MUI');
  assert.equal(rewrite('MIIII', 3, 2), 'MIU');
  assert.equal(rewrite('MUUUI', 4, 1), 'MUI');
  assert.throws(() => rewrite('MIU', 1, 1));
  assert.throws(() => rewrite('MIII', 3, 2));
});

test('overlapping matches remain distinct choices', () => {
  assert.deepEqual(occurrences('MIIIII', 3), [1, 2, 3]);
  assert.deepEqual(occurrences('MUUU', 4), [1, 2]);
  assert.deepEqual(occurrences('MI', 4), []);
});

test('reachable warm-up has a valid derivation', () => {
  const history = createHistory();
  appendStep(history, 2, 0);
  appendStep(history, 2, 0);
  appendStep(history, 1, 4);
  appendStep(history, 3, 1);
  assert.equal(history.nodes[history.current].word, 'MUIU');
  assert.equal(displayWord('MUIU', 'zh'), 'WUJU');
  assert.equal(displayWord('MUIU', 'en'), 'MUIU');
});

test('backtracking branches without deleting a proof; revisiting an edge reuses it', () => {
  const history = createHistory();
  const left = appendStep(history, 1, 1);
  history.current = 0;
  const right = appendStep(history, 2, 0);
  assert.equal(history.nodes.length, 3);
  assert.equal(left.word, 'MIU');
  assert.deepEqual(pathTo(history).map(n => n.word), ['MI', 'MII']);
  history.current = 0;
  assert.equal(appendStep(history, 2, 0), right);
  assert.equal(history.nodes.length, 3);
});

test('restored history validates every edge and rejects corrupt or cyclic paths', () => {
  const history = createHistory();
  appendStep(history, 2, 0);
  assert.deepEqual(restoreHistory(JSON.parse(JSON.stringify(history))), history);
  const invalid = structuredClone(history);
  invalid.nodes[1].word = 'MU';
  assert.deepEqual(restoreHistory(invalid), createHistory());
  invalid.nodes[1].parent = 1;
  assert.deepEqual(restoreHistory(invalid), createHistory());
  assert.deepEqual(restoreHistory({ nodes: null }), createHistory());
});

test('the exhibit cap leaves the mathematical rule and the existing history intact', () => {
  const history = createHistory();
  while (history.nodes[history.current].word.length * 2 - 1 <= DISPLAY_LIMIT) appendStep(history, 2, 0);
  const before = structuredClone(history);
  assert.ok(rewrite(history.nodes[history.current].word, 2, 0).length > DISPLAY_LIMIT);
  assert.throws(() => appendStep(history, 2, 0), /display-limit/);
  assert.deepEqual(history, before);
});

test('a full history preserves every node and still permits existing continuations', () => {
  const history = createHistory();
  const cycle = [[2, 0], [2, 0], [1, 4], [3, 2], [4, 2]];
  for (let i = 0; i < HISTORY_LIMIT - 1; i++) appendStep(history, ...cycle[i % cycle.length]);
  const before = structuredClone(history);
  assert.throws(() => appendStep(history, ...cycle[(HISTORY_LIMIT - 1) % cycle.length]), /history-limit/);
  assert.deepEqual(history, before);
  assert.deepEqual(restoreHistory(before), before);
  history.current = 0;
  assert.equal(appendStep(history, 2, 0).id, 1);
  assert.equal(history.nodes.length, HISTORY_LIMIT);
});

test('bounded exhaustive search preserves the nonzero remainder under every legal rewrite', () => {
  let frontier = new Set(['MI']);
  const visited = new Set(frontier);
  for (let depth = 0; depth < 9; depth++) {
    const next = new Set();
    for (const word of frontier) {
      for (const rule of [1, 2, 3, 4]) {
        for (const position of occurrences(word, rule)) {
          const result = rewrite(word, rule, position);
          assert.notEqual((result.split('I').length - 1) % 3, 0);
          assert.notEqual(result, 'MU');
          if (result.length <= 25 && !visited.has(result)) { visited.add(result); next.add(result); }
        }
      }
    }
    frontier = next;
  }
  assert.ok(visited.size > 100);
});
