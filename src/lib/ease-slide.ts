/**
 * Carousel slide ease from the Comfy API storyboard (`util.js` `ease.slide`).
 * Velocity is explicit, then integrated into a position LUT. v >= 0, so the
 * move never overshoots: ease(0) = 0, ease(1) = 1.
 */
const SLIDE_P = 0.365;
const SLIDE_N = 200;

function slideV(t: number): number {
  if (t <= 0 || t >= 1) return 0;
  if (t <= SLIDE_P) return Math.pow(t / SLIDE_P, 3.9);
  const dt = t - SLIDE_P;
  const cliff = Math.exp(-Math.pow(dt / 0.0055, 2.4));
  const tail = 0.135 * Math.exp(-dt / 0.082);
  return cliff * (1 - 0.135) + tail;
}

const slideLUT: Float64Array = (() => {
  const lut = new Float64Array(SLIDE_N + 1);
  const SUB = 8;
  let acc = 0;
  for (let i = 1; i <= SLIDE_N; i++) {
    const t0 = (i - 1) / SLIDE_N;
    let prev = slideV(t0);
    let bin = 0;
    for (let s = 1; s <= SUB; s++) {
      const cur = slideV(t0 + s / (SUB * SLIDE_N));
      bin += ((prev + cur) * 0.5) / SUB;
      prev = cur;
    }
    acc += bin / SLIDE_N;
    lut[i] = acc;
  }
  const tot = lut[SLIDE_N] || 1;
  for (let i = 0; i <= SLIDE_N; i++) lut[i] /= tot;
  return lut;
})();

/** Storyboard `NAV_S` (.99s), in milliseconds. */
export const NAV_MS = 990;

export function easeSlide(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const x = t * SLIDE_N;
  const i = Math.min(SLIDE_N - 1, Math.floor(x));
  const f = x - i;
  return slideLUT[i]! + (slideLUT[i + 1]! - slideLUT[i]!) * f;
}

/** Smallest space between two cards while they travel. */
export const MIN_CARD_GAP = 32;

/**
 * Space between cards. At least {@link MIN_CARD_GAP}, and at least the page
 * margin plus one pixel so the neighbor starts outside the browser viewport.
 */
export function trackGap(margin: number): number {
  return Math.max(MIN_CARD_GAP, Math.ceil(Math.max(0, margin)) + 1);
}

/** Outgoing opacity across the same progress as the slide. 1 at the start, 0 at the end. */
export function exitOpacity(progress: number): number {
  if (progress <= 0) return 1;
  if (progress >= 1) return 0;
  return 1 - progress;
}
