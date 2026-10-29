// Sora's animated mark rises above the old 8% band. A 16% bottom crop
// leaves headroom for its taller animation without zooming into the sides.
export const DEFAULT_FRAMING = { zoom: 100, crop: 16 };

export function normalizeFraming(value = {}) {
  const clamp = (number, fallback, min, max) => Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  return { zoom: clamp(value?.zoom, DEFAULT_FRAMING.zoom, 100, 160), crop: clamp(value?.crop, DEFAULT_FRAMING.crop, 0, 20) };
}

export function restoreFraming(saved, legacy) {
  if (saved != null) return normalizeFraming(saved);
  if (legacy != null && !(legacy.zoom === 100 && legacy.crop === 8)) return normalizeFraming(legacy);
  return { ...DEFAULT_FRAMING };
}

// Fit the retained portion of the source, rather than filling a wide stage
// with cover. Only the requested bottom band is removed at 100% zoom.
export function fitFrame(width, height, sourceWidth, sourceHeight, settings) {
  if (![width, height, sourceWidth, sourceHeight].every(n => Number.isFinite(n) && n > 0)) return null;
  const { zoom, crop } = normalizeFraming(settings);
  const retainedHeight = sourceHeight * (1 - crop / 100);
  const scale = Math.min(width / sourceWidth, height / retainedHeight);
  const frameWidth = sourceWidth * scale;
  const frameHeight = retainedHeight * scale;
  const multiplier = zoom / 100;
  return {
    width: frameWidth, height: frameHeight,
    mediaWidth: frameWidth * multiplier,
    mediaHeight: sourceHeight * scale * multiplier,
    left: frameWidth * (1 - multiplier) / 2,
    top: frameHeight * (1 - multiplier) / 2,
  };
}
