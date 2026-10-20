import { test } from 'node:test';
import assert from 'node:assert/strict';
import { letterGroups, discoveryAnswer, restoreDiscovery } from '../src/garden-discovery.js';
import { occurrences, rewrite } from '../src/miu-system.js';

test('grouping explains the reachable warm-up and the unreachable target', () => {
  const expected = [['MI', 1, 0, 1], ['MII', 2, 0, 2], ['MIIII', 4, 1, 1], ['MIIIIU', 4, 1, 1], ['MUIU', 1, 0, 1], ['MU', 0, 0, 0]];
  for (const [word, count, groups, remainder] of expected) {
    assert.deepEqual(letterGroups(word), { count, groups, remainder });
  }
});

test('the four displayed count transformations agree with every legal rewrite in a bounded search', () => {
  let frontier = new Set(['MI']);
  const seen = new Set(frontier), checked = new Set();
  for (let depth = 0; depth < 7; depth++) {
    const next = new Set();
    for (const word of frontier) {
      const before = letterGroups(word);
      for (let rule = 1; rule <= 4; rule++) for (const position of occurrences(word, rule)) {
        const result = rewrite(word, rule, position), after = letterGroups(result);
        const expected = rule === 2 ? before.count * 2 : rule === 3 ? before.count - 3 : before.count;
        assert.equal(after.count, expected);
        assert.equal(after.remainder, rule === 2 ? 3 - before.remainder : before.remainder);
        checked.add(rule);
        if (result.length <= 24 && !seen.has(result)) { seen.add(result); next.add(result); }
      }
    }
    frontier = next;
  }
  assert.deepEqual([...checked].sort(), [1, 2, 3, 4]);
});

test('completion requires the invariant explanation, not a failed attempt or an early answer', () => {
  assert.equal(discoveryAnswer('count', 'invariant'), 'count');
  assert.equal(discoveryAnswer('groups', 'invariant'), 'groups');
  assert.equal(discoveryAnswer('rules', 'attempts'), 'rules');
  assert.equal(discoveryAnswer('rules', 'invariant'), 'complete');
  assert.equal(discoveryAnswer('complete', 'attempts'), 'complete');
});

test('saved discovery stages resume and older or malformed stages start at observation', () => {
  for (const stage of ['count', 'groups', 'rules', 'complete']) assert.equal(restoreDiscovery(stage), stage);
  for (const stage of [undefined, null, 'won', true, 100]) assert.equal(restoreDiscovery(stage), 'count');
});
