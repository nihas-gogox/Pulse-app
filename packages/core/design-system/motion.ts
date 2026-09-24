/**
 * Calm, native motion — no bouncy startup springs on operational surfaces.
 */
export const motion = {
  duration: {
    instant: 120,
    fast: 200,
    normal: 280,
    slow: 400,
  },
  easing: {
    standard: 'ease-out',
    enter: 'ease-out',
    exit: 'ease-in',
  },
} as const;

/** Moti / Reanimated-friendly timing presets */
export const motiTransition = {
  fade: { type: 'timing' as const, duration: motion.duration.normal },
  slide: { type: 'timing' as const, duration: motion.duration.fast },
};

export default motion;
