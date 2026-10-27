// Attributed vector outlines with exhibition-only apertures.
// Marks stay; only the void plugs are removable.
import { FEDEX_ART, FEDEX_LABELS } from './fedex-exhibit.js';
import { LOGO_CONTOURS } from './logo-contours.js';

// The study region shares the gallery's original east-wall surface.
export const CUTOUT_ANCHOR = { x: 16.825, y: -0.4, z: 3.6 };
export const WALL = { w: 7.4, h: 6.7, d: 0.35, z: -0.35 };
// Full architectural wall in mount-local coordinates, not an overlay panel.
export const WALL_BOUNDS = { left: -22.8, right: 18.2, bottom: -3.4, top: 8.6 };
export const PLUG_DEPTH = WALL.d;
export const PLUG_CLOSED_Z = WALL.z;
export const PLUG_OPEN_Z = -0.8;
export const BACKLIGHT_Z = WALL.z - 0.025;
export const MARK_Z = WALL.z + WALL.d + 0.0005;
export const MARK_DEPTH = 0.016;
export const STUDY_ORDER = ['f1', 'fedex', 'toblerone'];

export const WALL_LABELS = {
  zh: { to: '看负空间墙', look: '看留白', reset: '填回墙面', back: '回到共边墙', alt: '三处镂空的负空间墙' },
  en: { to: 'Look at the cutout wall', look: 'Look at the gap', reset: 'Fill the wall', back: 'Back to the shared contour', alt: 'Negative-space wall with three cutouts' },
  ja: { to: '余白の壁を見る', look: '余白を見る', reset: '壁を埋める', back: '共通の輪郭へ戻る', alt: '三つの切り抜きがある余白の壁' },
  ko: { to: '여백의 벽 보기', look: '여백 보기', reset: '벽을 메우기', back: '공유 윤곽으로 돌아가기', alt: '세 곳이 뚫린 여백의 벽' },
  fr: { to: 'Voir le mur ajouré', look: 'Regarder le vide', reset: 'Reboucher le mur', back: 'Revenir au contour commun', alt: 'Mur ajouré de trois vides' },
  de: { to: 'Die ausgeschnittene Wand ansehen', look: 'Den Zwischenraum sehen', reset: 'Die Wand schließen', back: 'Zur gemeinsamen Kontur', alt: 'Ausgeschnittene Wand mit drei Hohlräumen' },
  es: { to: 'Ver el muro calado', look: 'Mirar el vacío', reset: 'Rellenar el muro', back: 'Volver al contorno compartido', alt: 'Muro calado con tres huecos' },
};

const F1_LABELS = {
  zh: { title: 'Formula 1 标志', role: '标志设计 · 单色观察', short: 'Formula 1', text: '除了 F 和速度线，你还看见了什么？', revealed: 'F 与速度线之间的空隙是数字 1。', source: '设计报道 ↗', annotation: '留白示意', alt: 'Formula 1 单色镂空观察' },
  en: { title: 'Formula 1 mark', role: 'Identity design · Monochrome study', short: 'Formula 1', text: 'What can you see besides the F and the speed lines?', revealed: 'The gap between the F and the speed lines is a 1.', source: 'Design report ↗', annotation: 'Negative-space study', alt: 'Formula 1 monochrome cutout study' },
  ja: { title: 'Formula 1 の標章', role: 'ロゴデザイン · 単色で観察', short: 'Formula 1', text: 'F と速度線のほかに、何が見えますか？', revealed: 'F と速度線の間の空隙が数字の 1 です。', source: 'デザイン記事 ↗', annotation: '余白の解説', alt: 'Formula 1 の単色の切り抜き' },
  ko: { title: 'Formula 1 표장', role: '로고 디자인 · 단색 관찰', short: 'Formula 1', text: 'F와 속도선 말고 무엇이 보이나요?', revealed: 'F와 속도선 사이의 틈이 숫자 1입니다.', source: '디자인 기사 ↗', annotation: '여백 해설', alt: 'Formula 1 단색 투각' },
  fr: { title: 'Signe Formula 1', role: 'Identité visuelle · Étude monochrome', short: 'Formula 1', text: 'Que voyez-vous à part le F et les traits de vitesse ?', revealed: 'Le vide entre le F et les traits de vitesse est un 1.', source: 'Article de design ↗', annotation: 'Étude du vide', alt: 'Étude monochrome ajourée de Formula 1' },
  de: { title: 'Formula-1-Zeichen', role: 'Markengestaltung · Monochrome Studie', short: 'Formula 1', text: 'Was sehen Sie außer dem F und den Geschwindigkeitslinien?', revealed: 'Der Zwischenraum zwischen F und den Geschwindigkeitslinien ist eine 1.', source: 'Designbericht ↗', annotation: 'Studie des Zwischenraums', alt: 'Monochrome Formula-1-Ausschnittstudie' },
  es: { title: 'Signo de Formula 1', role: 'Identidad visual · Estudio monocromo', short: 'Formula 1', text: '¿Qué ves además de la F y las líneas de velocidad?', revealed: 'El vacío entre la F y las líneas de velocidad es un 1.', source: 'Informe de diseño ↗', annotation: 'Estudio del vacío', alt: 'Estudio monocromo calado de Formula 1' },
};

const TOBLERONE_LABELS = {
  zh: { title: 'Toblerone 山形', role: '包装图形 · 单色观察', short: 'Toblerone', text: '山里还藏着什么？', revealed: '山体中的留白是一只熊。', source: '设计者访谈 ↗', annotation: '留白示意', alt: 'Toblerone 山中熊的单色镂空' },
  en: { title: 'Toblerone mountain', role: 'Packaging graphic · Monochrome study', short: 'Toblerone', text: 'What else is hidden in the mountain?', revealed: 'The gap in the mountain is a bear.', source: 'Illustrator interview ↗', annotation: 'Negative-space study', alt: 'Toblerone monochrome cutout of the bear in the mountain' },
  ja: { title: 'Toblerone の山', role: '包装図案 · 単色で観察', short: 'Toblerone', text: '山の中に、ほかに何が隠れていますか？', revealed: '山の余白は一頭の熊です。', source: '作者へのインタビュー ↗', annotation: '余白の解説', alt: '山中の熊を示す Toblerone の単色切り抜き' },
  ko: { title: 'Toblerone 산', role: '포장 그래픽 · 단색 관찰', short: 'Toblerone', text: '산속에 또 무엇이 숨겨져 있나요?', revealed: '산의 여백은 곰입니다.', source: '작가 인터뷰 ↗', annotation: '여백 해설', alt: '산속 곰을 보여주는 Toblerone 단색 투각' },
  fr: { title: 'Montagne Toblerone', role: 'Graphisme d’emballage · Étude monochrome', short: 'Toblerone', text: 'Que cache encore la montagne ?', revealed: 'Le vide dans la montagne est un ours.', source: 'Entretien avec l’illustrateur ↗', annotation: 'Étude du vide', alt: 'Découpe monochrome de l’ours dans la montagne Toblerone' },
  de: { title: 'Toblerone-Berg', role: 'Verpackungsgrafik · Monochrome Studie', short: 'Toblerone', text: 'Was verbirgt sich noch im Berg?', revealed: 'Der Zwischenraum im Berg ist ein Bär.', source: 'Gespräch mit dem Illustrator ↗', annotation: 'Studie des Zwischenraums', alt: 'Monochrome Toblerone-Studie des Bären im Berg' },
  es: { title: 'Montaña de Toblerone', role: 'Gráfico de envase · Estudio monocromo', short: 'Toblerone', text: '¿Qué más se esconde en la montaña?', revealed: 'El vacío en la montaña es un oso.', source: 'Entrevista al ilustrador ↗', annotation: 'Estudio del vacío', alt: 'Calado monocromo del oso en la montaña de Toblerone' },
};

export const F1_ART = {
  designer: 'Carter Wong',
  year: '1994–2017',
  source: 'https://www.creativebloq.com/news/formula-1-ditches-its-negative-space-logo',
};
export const TOBLERONE_ART = {
  designer: 'Andrew Davidson',
  year: 2000,
  source: 'https://www.raconteur.net/design-innovation/the-man-behind-toblerones-bear-in-the-mountain-logo-on-what-makes-an-iconic-image',
};

export function signedArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}
export function oriented(points, ccw) {
  const positive = signedArea(points) > 0;
  return positive === ccw ? points : [...points].reverse();
}
export function contains(points, x, y) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const CUTOUT_STUDIES = [
  { id: 'f1', art: F1_ART, labels: F1_LABELS, centerY: 2.22 },
  { id: 'fedex', art: FEDEX_ART, labels: FEDEX_LABELS, centerY: 0 },
  { id: 'toblerone', art: TOBLERONE_ART, labels: TOBLERONE_LABELS, centerY: -2.24 },
].map(study => {
  const contours = LOGO_CONTOURS[study.id];
  const vertices = contours.shapes.flat(2);
  const size = { width: Math.max(...vertices.map(p => p[0])) - Math.min(...vertices.map(p => p[0])),
    height: Math.max(...vertices.map(p => p[1])) - Math.min(...vertices.map(p => p[1])) };
  return { ...study, holes: [contours.hole], sample: contours.sample, size,
    marks: contours.shapes.map(shape => shape[0]),
    markHoles: contours.shapes.map(shape => shape.slice(1)),
  };
});

export function studyById(id) {
  return CUTOUT_STUDIES.find((study) => study.id === id) ?? CUTOUT_STUDIES[1];
}

const SCALE = 100;
function svgPoint([x, y]) {
  return [(x + WALL.w / 2) * SCALE, (WALL.h / 2 - y) * SCALE];
}
function pathData(points) {
  return `${points.map((point, index) => `${index ? 'L' : 'M'}${svgPoint(point).map((value) => value.toFixed(2)).join(' ')}`).join('')}Z`;
}

export function negativeSpaceSVG({ revealed = false, focus = null } = {}) {
  const holes = CUTOUT_STUDIES.flatMap((study) => study.holes);
  const light = '#f4f1ea';
  const wall = '#8e918d';
  const ink = '#343732';
  const width = WALL.w * SCALE;
  const height = WALL.h * SCALE;
  const framed = focus ? studyById(focus) : null;
  const frameTop = framed ? (WALL.h / 2 - (framed.centerY + 1.05)) * SCALE : 0;
  const frameHeight = framed ? 2.1 * SCALE : height;
  const maskHoles = holes.map((points) => `<path d="${pathData(oriented(points, false))}" fill="black"/>`).join('');
  const plugs = revealed ? '' : holes.map((points) => `<path class="ns-plug" d="${pathData(points)}" fill="${wall}"/>`).join('');
  const marks = CUTOUT_STUDIES.flatMap(study => study.marks.map((points, index) => {
    const holes = study.markHoles[index].map(hole => pathData(oriented(hole, false))).join('');
    return `<path class="ns-mark ns-study ns-study-${study.id}" fill="${ink}" fill-rule="evenodd" d="${pathData(oriented(points, true))}${holes}"/>`;
  })).join('');
  const maskId = `ns-cutout-mask-${framed ? framed.id : 'all'}`;
  return `<svg viewBox="0 ${frameTop.toFixed(2)} ${width} ${frameHeight.toFixed(2)}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect class="ns-light" x="0" y="0" width="${width}" height="${height}" fill="${light}"/><defs><mask id="${maskId}" maskContentUnits="userSpaceOnUse"><rect x="0" y="0" width="${width}" height="${height}" fill="white"/>${maskHoles}</mask></defs><rect class="ns-wall" x="0" y="0" width="${width}" height="${height}" fill="${wall}" mask="url(#${maskId})"/>${plugs}${marks}</svg>`;
}
