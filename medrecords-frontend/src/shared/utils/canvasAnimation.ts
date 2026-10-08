/**
 * Lightweight canvas animation helper.
 *
 * Drives a `requestAnimationFrame` loop that calls `onFrame(progress)` with
 * an eased 0→1 progress value, used by hand-rolled Canvas 2D charts (bar /
 * donut charts on the dashboards) to animate bars growing and donut slices
 * sweeping in on first paint, instead of popping in fully drawn.
 *
 * Returns a cancel function — callers should invoke it in their effect
 * cleanup so a re-render (e.g. new data) doesn't leave a stale animation
 * loop running alongside a new one.
 */

/** Ease-out-cubic — fast start, gentle settle. Feels natural for chart reveals. */
export function easeOutCubic(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return 1 - Math.pow(1 - clamped, 3);
}

export interface AnimateOptions {
  /** Duration in milliseconds. Defaults to 650ms. */
  duration?: number;
  /** Easing function applied to the linear 0→1 time progress. */
  easing?: (t: number) => number;
}

/**
 * Runs `onFrame(easedProgress)` on every animation frame until progress
 * reaches 1, then calls it one final time with exactly 1.
 */
export function animate(
  onFrame: (progress: number) => void,
  options: AnimateOptions = {},
): () => void {
  const { duration = 650, easing = easeOutCubic } = options;
  const start = performance.now();
  let frameId: number;
  let cancelled = false;

  const tick = (now: number) => {
    if (cancelled) return;
    const elapsed = now - start;
    const t = Math.min(elapsed / duration, 1);
    onFrame(easing(t));
    if (t < 1) {
      frameId = requestAnimationFrame(tick);
    }
  };

  frameId = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    if (frameId) cancelAnimationFrame(frameId);
  };
}
