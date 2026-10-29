import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FRAMING, normalizeFraming, fitFrame } from '../static/framing.js';

test('the default keeps the entire width and top, cutting only the bottom 8%', () => {
  for (const source of [[1920, 1080], [1080, 1920], [1024, 1024]]) {
    for (const stage of [[1280, 400], [340, 500]]) {
      const box = fitFrame(...stage, ...source, DEFAULT_FRAMING);
      assert.ok(box.width <= stage[0] + 1e-8);
      assert.ok(box.height <= stage[1] + 1e-8);
      assert.equal(box.left, 0);
      assert.equal(box.top, 0);
      assert.equal(box.width, box.mediaWidth);
      assert.ok(Math.abs(box.height / box.mediaHeight - 0.92) < 1e-8);
      assert.ok(Math.abs(box.mediaWidth / box.mediaHeight - source[0] / source[1]) < 1e-8);
    }
  }
});

test('manual zoom is centered on the retained area without changing the clipping frame', () => {
  const normal = fitFrame(1280, 400, 1920, 1080, { zoom: 100, crop: 8 });
  const zoom = fitFrame(1280, 400, 1920, 1080, { zoom: 125, crop: 8 });
  assert.equal(normal.width, zoom.width);
  assert.equal(normal.height, zoom.height);
  assert.equal(zoom.mediaWidth, normal.mediaWidth * 1.25);
  assert.ok(zoom.left < 0 && zoom.top < 0);
  const full = fitFrame(1280, 400, 1920, 1080, { zoom: 100, crop: 0 });
  assert.equal(full.height, full.mediaHeight);
});

test('settings are bounded and unloaded media does not receive invalid sizes', () => {
  assert.deepEqual(normalizeFraming(null), DEFAULT_FRAMING);
  assert.deepEqual(normalizeFraming({ zoom: Infinity, crop: -9 }), { zoom: 100, crop: 0 });
  assert.deepEqual(normalizeFraming({ zoom: 999, crop: 80 }), { zoom: 160, crop: 20 });
  assert.equal(fitFrame(1200, 400, 0, 0, DEFAULT_FRAMING), null);
});
