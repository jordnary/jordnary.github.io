// Rigid poses in the drawing's coordinate system: [frame at 30 fps, x, y, degrees].
// Keep the contact frames; interpolate the travel between them at the display's
// refresh rate. The SVG scales the entire scene, including its floor, as one unit.
type Pose = readonly [number, number, number, number]

export const digitTracks: readonly (readonly Pose[])[] = [
  [ // The upper four balances on the zero, tips, then slides on its long edge.
    [0, 1100, 205, -1], [4, 1068, 304, 1.5], [8, 1037, 414, 4.4],
    [11, 1019, 468, 5.7], [18, 971, 470, -0.9], [28, 909, 473, -8.8],
    [35, 867, 481, -14.9], [41, 830, 495, -22.9], [47, 794, 521, -35.2],
    [51, 773, 547, -44], [56, 745, 603, -59.5], [57, 730, 618, -63.7],
    [63, 659, 686, -78.3], [68, 599, 763, -91.7], [74, 531, 884, -108.3],
    [78, 495, 968, -118], [82, 449, 1102, -130.2], [85, 421, 1125, -127],
    [86, 414, 1127, -126.8], [94, 379, 1127, -126.7], [98, 364, 1127, -126.7],
  ],
  [ // The oval takes the impact upright. Its centre drops as it rolls onto its side.
    [0, 1120, 752, 44], [4, 1092, 851, 26.8], [8, 1064, 973, 5.8],
    [11, 1042, 1024, -2.3], [13, 1025, 1022, -3], [18, 997, 1023, -7],
    [22, 985, 1023, -9], [28, 972, 1023, -9.8], [40, 962, 1026, -16.5],
    [54, 963, 1027, -20.9], [64, 976, 1033, -28.6], [72, 965, 1043, -38.5],
    [79, 939, 1060, -51.1], [83, 911, 1080, -62.3], [90, 894, 1100, -74.7],
    [96, 860, 1115, -90.8], [101, 850, 1114, -91.2], [107, 852, 1114, -90.4],
    [113, 852, 1114, -90.6],
  ],
  [ // The lower four catches the floor first, rocks back and stays put.
    [0, 1445, 1082, -13.8], [4, 1466, 1107, -17.7], [10, 1484, 1112, -21.4],
    [15, 1496, 1123, -27.7], [18, 1498, 1121, -29.3], [20, 1498, 1123, -29.4],
    [22, 1498, 1125, -28.4],
  ],
]

export const curtainDelay = 3500

export function animateDigit(element: SVGPathElement, track: readonly Pose[]) {
  const end = track[track.length - 1][0]
  return element.animate(track.map(([frame, x, y, angle]) => ({
    offset: frame / end,
    transform: `translate(${x}px, ${y}px) rotate(${angle}deg)`,
  })), { duration: end * 1000 / 30, delay: curtainDelay, fill: 'backwards' })
}
