import test from 'node:test';
import assert from 'node:assert/strict';
import { MaterialAmplifier, normalizeBoost } from '../static/amplifier.js';

class Node {
  constructor() { this.connections = new Set(); }
  connect(node) { this.connections.add(node); }
  disconnect() { this.connections.clear(); }
}
class Context {
  constructor() { this.currentTime = 20; this.state = 'suspended'; this.destination = new Node(); this.created = []; }
  createGain() {
    const node = new Node();
    node.gain = { value: 1, setTargetAtTime(value, time, duration) { this.value = value; this.ramp = [time, duration]; } };
    return node;
  }
  createMediaElementSource(element) { const node = new Node(); node.element = element; this.created.push(node); return node; }
  resume() { this.state = 'running'; return Promise.resolve(); }
}

test('gain exceeds native volume without changing volume or mute, and reconnects only once', () => {
  const amp = new MaterialAmplifier(Context, 3);
  const media = { tagName: 'AUDIO', volume: 0.7, muted: true };
  assert.equal(amp.attach(media), true);
  assert.equal(amp.gain.gain.value, 3);
  assert.equal(amp.context.state, 'running');
  amp.attach(media);
  assert.equal(amp.context.created.length, 1);
  assert.equal(amp.context.created[0].connections.size, 1);
  assert.equal(media.volume, 0.7);
  assert.equal(media.muted, true);
  amp.set(4);
  assert.equal(amp.gain.gain.value, 4);
  assert.deepEqual(amp.gain.gain.ramp, [20, 0.02]);
});

test('a new turn disconnects the preceding source and keeps the selected gain', () => {
  const amp = new MaterialAmplifier(Context);
  const first = { tagName: 'AUDIO' }, second = { tagName: 'VIDEO' };
  amp.attach(first); amp.set(2.5); amp.attach(second);
  assert.equal(amp.context.created[0].connections.size, 0);
  assert.equal(amp.context.created[1].connections.has(amp.gain), true);
  assert.equal(amp.gain.gain.value, 2.5);
  amp.detach();
  assert.equal(amp.context.created[1].connections.size, 0);
  amp.attach(first);
  assert.equal(amp.context.created.length, 2);
});

test('unsupported browsers and images stay on native playback; malformed settings remain bounded', () => {
  assert.equal(new MaterialAmplifier(null).attach({ tagName: 'AUDIO' }), false);
  const amp = new MaterialAmplifier(Context);
  assert.equal(amp.attach({ tagName: 'IMG' }), false);
  assert.equal(amp.context, undefined);
  for (const value of [null, 'bad', Infinity, -10, 0]) assert.equal(normalizeBoost(value), 1);
  assert.equal(normalizeBoost(20), 4);
  assert.equal(normalizeBoost('2.5'), 2.5);
  assert.equal(amp.unlock(), true);
  assert.equal(amp.context.created.length, 0);
});
