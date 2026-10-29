export function normalizeBoost(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(4, Math.max(1, number)) : 1;
}

// Independent gain for the round's media. Native volume and mute still work.
export class MaterialAmplifier {
  constructor(Context, value = 1) {
    this.Context = Context;
    this.value = normalizeBoost(value);
    this.sources = new WeakMap();
    this.active = null;
  }

  set(value) {
    this.value = normalizeBoost(value);
    if (this.gain) this.gain.gain.setTargetAtTime(this.value, this.context.currentTime, 0.02);
    return this.value;
  }

  unlock() {
    if (!this.Context) return false;
    if (!this.context) {
      this.context = new this.Context();
      this.gain = this.context.createGain();
      this.gain.gain.value = this.value;
      this.gain.connect(this.context.destination);
    }
    if (this.context.state !== 'running') this.context.resume().catch(() => {});
    return true;
  }

  attach(media) {
    if (!['AUDIO', 'VIDEO'].includes(media?.tagName) || !this.unlock()) return false;
    if (this.active !== media) {
      this.detach();
      let source = this.sources.get(media);
      if (!source) {
        source = this.context.createMediaElementSource(media);
        this.sources.set(media, source);
      }
      source.connect(this.gain);
      this.active = media;
    }
    return true;
  }

  detach() {
    if (this.active) this.sources.get(this.active).disconnect();
    this.active = null;
  }
}
