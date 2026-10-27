// Offline only: preserve source SVG curves as resolution-independent wall geometry.
// Re-run with `npm run logos:generate`. No XML parser is shipped to browsers.
import { readFile, writeFile } from 'node:fs/promises';
import { DOMParser } from '@xmldom/xmldom';
import polygonClipping from 'polygon-clipping';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { FEDEX_ARROW } from '../src/fedex-exhibit.js';

globalThis.DOMParser = DOMParser;
const loader = new SVGLoader();
const precision = n => +n.toFixed(6);
const ring = path => {
  const points = path.getPoints(24).map(p => [p.x, p.y]);
  return points.filter((p,i) => !i || Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1])>1e-7);
};
async function load(name) {
  const svg = await readFile(new URL(`../assets/art/${name}`,import.meta.url),'utf8');
  return loader.parse(svg).paths.flatMap(path => SVGLoader.createShapes(path)).map(shape => [ring(shape),...shape.holes.map(ring)]);
}
const f1 = await load('f1-classic.svg');
const fedex = (await load('fedex.svg')).filter(shape => Math.max(...shape[0].map(p=>p[1]))<741);
const mountain = await load('toblerone-mountain.svg');
// Fill the complete central gap: follow the F edge on the left and both
// speed-line groups on the right, closing only at the logo top and baseline.
const onePath = `<svg xmlns="http://www.w3.org/2000/svg"><path d="M111.467 6.503 L130.57 6.508 L98.127 52.844 L116.124 52.374 L102.932 71.201 L44.597 71.201 L57.459 52.824 L74.339 52.829 L86.608 35.3 L69.725 35.32 L78.181 23.231 C92.421 23.231 103.048 14.988 111.467 6.503 Z"/></svg>`;
const oneOutline = ring(SVGLoader.createShapes(loader.parse(onePath).paths[0])[0]);
const one = polygonClipping.difference([[oneOutline]],...f1)[0][0];
// The bear is connected to the snow in the published emblem. This envelope
// closes those open snow channels; clipping preserves the actual rock edges.
const bearEnvelope = [[21.6,91.7],[24.4,91.7],[26.6,97.5],[23.4,99.1],[20.3,102.6],[18.1,104.4],[17.6,103.6],[18.3,101.8],[19.4,99.5],[19.6,97.7],[19.7,95.6],[20.4,93.7],[21.2,92.7]];
const bearRegions = polygonClipping.difference([bearEnvelope],...mountain);
const area = points => Math.abs(points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2);
bearRegions.sort((a,b)=>area(b[0])-area(a[0]));
const bear = bearRegions[0][0];
function normalize(polygons, cx, cy, scale, y) {
  return polygons.map(polygon => polygon.map(points=>points.map(([px,py])=>[precision((px-cx)*scale),precision((cy-py)*scale+y)])));
}
const data = {
  f1: { shapes:normalize(f1,102.4,38.852,5.25/163.2,2.22), hole:normalize([[one]],102.4,38.852,5.25/163.2,2.22)[0][0], sample:[.04,2.22] },
  fedex: { shapes:normalize(fedex,1150,340,5.7/2300,0), hole:normalize([[FEDEX_ARROW]],1150,340,5.7/2300,0)[0][0], sample:normalize([[[[1600,460]]]],1150,340,5.7/2300,0)[0][0][0] },
  toblerone: { shapes:normalize(mountain,23.2,96.25,2.75/24,-2.24), hole:normalize([[bear]],23.2,96.25,2.75/24,-2.24)[0][0], sample:normalize([[[[22.5,96]]]],23.2,96.25,2.75/24,-2.24)[0][0][0] },
};
await writeFile(new URL('../src/logo-contours.js',import.meta.url),'// Generated from the attributed SVG studies by scripts/generate-logo-contours.mjs.\n// Keep source artwork and apertures in the same coordinate system.\nexport const LOGO_CONTOURS = '+JSON.stringify(data)+';\n');
console.log(Object.fromEntries(Object.entries(data).map(([id,v])=>[id,{shapes:v.shapes.length,vertices:v.shapes.flat(2).length,hole:v.hole.length}])));
