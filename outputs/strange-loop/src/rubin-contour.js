// Original shared contour, in architectural units. Both walls use exactly this boundary.
export const PROFILE = [
  ['M', 1.4, 6], ['C', .88, 5.65, .85, 5.35, .92, 5.02],
  ['C', .95, 4.84, .6, 4.52, .38, 4.28],
  ['L', .72, 4.1], ['C', .68, 4.02, .62, 4.01, .65, 3.94],
  ['L', .76, 3.86], ['C', .62, 3.77, .68, 3.6, .83, 3.54],
  ['C', 1.04, 3.47, 1.35, 3.54, 1.51, 3.22],
  ['C', 1.82, 2.6, 1.62, 2.3, 1.4, 1.87],
  ['C', 1.18, 1.4, 1.12, 1.06, 1.34, .66], ['L', 1.8, 0],
];
export function traceProfile(path, side = 1) {
  for (const [op, ...values] of PROFILE) {
    const v = values.map((n, i) => i % 2 === 0 ? n * side : n);
    path[op === 'M' ? 'moveTo' : op === 'L' ? 'lineTo' : 'bezierCurveTo'](...v);
  }
  return path;
}
export function rubinSVG() {
  const profile = side => PROFILE.map(([op, ...v]) => op + v.map((n, i) => i % 2 === 0 ? 400 + n * side * 90 : 580 - n * 90).join(' ')).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 620"><rect width="800" height="620" fill="#e7e7e4"/><path d="${profile(-1)} L40 580 L40 40 Z ${profile(1)} L760 580 L760 40 Z" fill="#515550"/></svg>`;
}
