// A commentary exhibit; the FedEx mark remains a third-party trademark.
export const FEDEX_ART = {
 file:'assets/art/fedex.svg', designer:'Lindon Leader · Landor', year:1994,
 source:'https://thesneeze.com/the-man-behind-the-fedex-logo/',
};
// The negative-space boundary in the supplied vector, shared by the
// 3D annotation and the accessible HTML fallback. No letters are moved.
export const FEDEX_ARROW = [[1490,390],[1710,390],[1710,250],[1900,460],[1710,680],[1710,530],[1490,530]];
export const FEDEX_LABELS = {
 zh:{title:'FedEx 字标',role:'字标设计 · 单色观察',to:'看字母间的留白',look:'看留白',reset:'回看字标',back:'回到共边墙',text:'除了字母，你还看见了什么？',revealed:'E 与 x 之间的空白形成向右的箭头。字母没有移动，留白有了方向。',source:'设计师访谈 ↗',annotation:'留白示意',alt:'FedEx 单色字标'},
 en:{title:'FedEx wordmark',role:'Identity design · Monochrome study',to:'Look between the letters',look:'Look at the gap',reset:'See the wordmark',back:'Back to the shared contour',text:'What can you see besides the letters?',revealed:'The space between E and x forms a right-pointing arrow. The letters stay still; the gap gains direction.',source:'Designer interview ↗',annotation:'Negative-space study',alt:'FedEx monochrome wordmark'},
 ja:{title:'FedEx ロゴ',role:'ロゴデザイン · 単色で観察',to:'文字の間の余白へ',look:'余白を見る',reset:'ロゴに戻る',back:'共通の輪郭へ戻る',text:'文字のほかに、何が見えますか？',revealed:'E と x の間の余白が右向きの矢印になります。文字は動かず、余白に方向が生まれます。',source:'デザイナーへのインタビュー ↗',annotation:'余白の解説図',alt:'FedEx の単色ロゴ'},
 ko:{title:'FedEx 워드마크',role:'로고 디자인 · 단색 관찰',to:'글자 사이의 여백 보기',look:'여백 보기',reset:'워드마크 다시 보기',back:'공유 윤곽으로 돌아가기',text:'글자 말고 무엇이 보이나요?',revealed:'E와 x 사이의 여백이 오른쪽 화살표를 만듭니다. 글자는 그대로인데 여백에 방향이 생깁니다.',source:'디자이너 인터뷰 ↗',annotation:'여백 해설',alt:'FedEx 단색 워드마크'},
 fr:{title:'Logotype FedEx',role:'Identité visuelle · Étude monochrome',to:'Regarder entre les lettres',look:'Regarder le vide',reset:'Revoir le logotype',back:'Revenir au contour commun',text:'Que voyez-vous à part les lettres ?',revealed:'Le vide entre E et x forme une flèche vers la droite. Les lettres restent en place ; le vide prend une direction.',source:'Entretien avec le créateur ↗',annotation:'Étude du vide',alt:'Logotype FedEx monochrome'},
 de:{title:'FedEx-Wortmarke',role:'Markengestaltung · Monochrome Studie',to:'Zwischen die Buchstaben sehen',look:'Den Zwischenraum sehen',reset:'Die Wortmarke ansehen',back:'Zur gemeinsamen Kontur',text:'Was sehen Sie außer den Buchstaben?',revealed:'Der Zwischenraum zwischen E und x bildet einen Pfeil nach rechts. Die Buchstaben bleiben stehen; die Lücke erhält eine Richtung.',source:'Interview mit dem Gestalter ↗',annotation:'Studie des Zwischenraums',alt:'Monochrome FedEx-Wortmarke'},
 es:{title:'Logotipo de FedEx',role:'Identidad visual · Estudio monocromo',to:'Mirar entre las letras',look:'Mirar el vacío',reset:'Volver al logotipo',back:'Volver al contorno compartido',text:'¿Qué ves además de las letras?',revealed:'El espacio entre E y x forma una flecha hacia la derecha. Las letras no se mueven; el vacío adquiere dirección.',source:'Entrevista al diseñador ↗',annotation:'Estudio del espacio negativo',alt:'Logotipo monocromo de FedEx'},
};
export function fedexStudySVG(revealed=false){
 return `<svg viewBox="0 -60 2300 800" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><image href="${FEDEX_ART.file}" x="0" y="-60" width="2300" height="800" opacity="${revealed?.2:1}"/>${revealed?`<polygon points="${FEDEX_ARROW.map(p=>p.join(',')).join(' ')}" fill="#343732"/>`:''}</svg>`;
}
