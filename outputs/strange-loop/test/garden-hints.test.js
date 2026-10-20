import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gardenHint } from '../src/garden-hints.js';
import { occurrences, rewrite } from '../src/miu-system.js';

test('suggested operations are legal throughout reachable short strings', () => {
  let frontier = new Set(['MI']), seen = new Set(frontier);
  for (let depth = 0; depth < 7; depth++) {
    const next = new Set();
    for (const word of frontier) {
      for (const practice of [false, true]) {
        const suggestion = gardenHint(word, practice, null);
        if (suggestion.rule) assert.ok(occurrences(word, suggestion.rule).length, `${word}: ${suggestion.rule}`);
      }
      for (let rule = 1; rule <= 4; rule++) for (const position of occurrences(word, rule)) {
        const result = rewrite(word, rule, position);
        if (result.length <= 24 && !seen.has(result)) { seen.add(result); next.add(result); }
      }
    }
    frontier = next;
  }
});

test('help follows the current choice and offers a way back without claiming a solution to MU', () => {
  assert.equal(gardenHint('MIIIIU', true, 3).key, 'frontGroup');
  assert.equal(gardenHint('MIIIIU', false, 3).key, 'choose');
  assert.equal(gardenHint('MUIU', true, null).key, 'complete');
  assert.equal(gardenHint('MIU', true, null).key, 'detour');
  assert.equal(gardenHint('M' + 'I'.repeat(64), false, null).key, 'shorter');
  const { rule } = gardenHint('MUIU', false, null);
  assert.ok(rule); assert.notEqual(rewrite('MUIU', rule, occurrences('MUIU', rule)[0]), 'MU');
});
