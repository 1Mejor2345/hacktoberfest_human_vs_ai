import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FRAMING, normalizeFraming, restoreFraming, fitFrame } from '../static/framing.js';

test('the default keeps the entire width and top, cutting only the bottom 16%', () => {
  for (const source of [[1920, 1080], [1080, 1920], [1024, 1024]]) {
    for (const stage of [[1280, 400], [340, 500]]) {
      const box = fitFrame(...stage, ...source, DEFAULT_FRAMING);
      assert.ok(box.width <= stage[0] + 1e-8);
      assert.ok(box.height <= stage[1] + 1e-8);
      assert.equal(box.left, 0);
      assert.equal(box.top, 0);
      assert.equal(box.width, box.mediaWidth);
      assert.ok(Math.abs(box.height / box.mediaHeight - 0.84) < 1e-8);
      assert.ok(Math.abs(box.mediaWidth / box.mediaHeight - source[0] / source[1]) < 1e-8);
    }
  }
});

test('the former default migrates while deliberate settings and future resets are retained', () => {
  assert.deepEqual(restoreFraming(null, null), { zoom: 100, crop: 16 });
  assert.deepEqual(restoreFraming(null, { zoom: 100, crop: 8 }), DEFAULT_FRAMING);
  assert.deepEqual(restoreFraming(null, { zoom: 110, crop: 14 }), { zoom: 110, crop: 14 });
  assert.deepEqual(restoreFraming({ zoom: 100, crop: 8 }, null), { zoom: 100, crop: 8 });
  assert.deepEqual(restoreFraming(DEFAULT_FRAMING, { zoom: 120, crop: 10 }), DEFAULT_FRAMING);
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
