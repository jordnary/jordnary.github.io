/** Shared by the HTML startup interlude and the React navigation interlude. */
export const projectTransitionMotion = {
  cover: 800,
  hold: 160,
  reveal: 540,
  lineDuration: 500,
  lineFadeDuration: 500,
  copyDelay: 150,
  copyDuration: 270,
  // Equal-speed rules descend in a left-to-right cascade, then fade in the same order.
  lineDelays: [0, 25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300],
  easing: 'cubic-bezier(.4, 0, .2, 1)',
}
