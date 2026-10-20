import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderResolution, observePixelRatio } from '../src/render-resolution.js';

test('Retina desktop uses 2x pixels while respecting native and mobile limits', () => {
  assert.deepEqual(renderResolution(1162, 954, 2), { pixelRatio: 2, bufferWidth: 2324, bufferHeight: 1908 });
  assert.equal(renderResolution(1162, 954, 3).pixelRatio, 2);
  assert.equal(renderResolution(1162, 954, 1).pixelRatio, 1);
  assert.equal(renderResolution(1162, 954, .75).pixelRatio, .75);
  assert.equal(renderResolution(760, 844, 3).pixelRatio, 1.25);
  assert.equal(renderResolution(761, 844, 3).pixelRatio, 2);
});

test('fractional DPR uses exact integer pixel dimensions for matching buffers and FXAA', () => {
  assert.deepEqual(renderResolution(390, 845, 3), { pixelRatio: 1.25, bufferWidth: 487, bufferHeight: 1056 });
  assert.deepEqual(renderResolution(1163, 955, 1.5), { pixelRatio: 1.5, bufferWidth: 1744, bufferHeight: 1432 });
  for (const ratio of [undefined, NaN, Infinity, 0, -1]) assert.equal(renderResolution(1162, 954, ratio).pixelRatio, 1);
});

test('DPR observation follows consecutive display changes without a resize and cleans up', () => {
  const queries = [], notifications = [];
  const host = {
    devicePixelRatio: 1,
    matchMedia(text) {
      const query = new EventTarget(); query.media = text; queries.push(query); return query;
    },
  };
  const stop = observePixelRatio(() => notifications.push(host.devicePixelRatio), host);
  assert.equal(queries[0].media, '(resolution: 1dppx)');
  host.devicePixelRatio = 2; queries[0].dispatchEvent(new Event('change'));
  assert.equal(queries[1].media, '(resolution: 2dppx)');
  host.devicePixelRatio = 1.5; queries[1].dispatchEvent(new Event('change'));
  assert.equal(queries[2].media, '(resolution: 1.5dppx)');
  queries[0].dispatchEvent(new Event('change'));
  assert.deepEqual(notifications, [2, 1.5]);
  stop(); queries[2].dispatchEvent(new Event('change'));
  assert.deepEqual(notifications, [2, 1.5]);
});
