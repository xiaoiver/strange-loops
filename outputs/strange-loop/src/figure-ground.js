import { STUDY_ORDER, WALL_LABELS, negativeSpaceSVG, studyById } from './cutout-studies.js';
import { ART_LABELS, LOBSTER_POSTERS, LOBSTER_CREDIT, RUBIN_LABELS, RUBIN_CREDIT } from './gallery-art.js';
import { FIGURE_COPY } from './figure-ground-copy.js';
import { COPY } from './copy.js';
import { LABYRINTH_COPY } from './labyrinth-copy.js';
import { FIGURE_STORAGE, initialFigureState, restoreFigureState, advanceFigure, figureStage, figureNavigation } from './figure-ground-system.js';

export function createFigureGround(root, { locale: initialLocale, navigation, onState, onMeet, onBack, onNext, onAnnounce }) {
  let locale = initialLocale, state = initialFigureState(), active = false, poster = false, coEdgeFocus = null, fedex = false, arrow = false, study = 'fedex';
  try { state = restoreFigureState(JSON.parse(localStorage.getItem(FIGURE_STORAGE))); } catch { /* Storage is optional. */ }
  fedex = figureStage(state) === 'marks';
  const c = () => FIGURE_COPY[locale];
  const viewingPosters = () => !fedex && (poster || figureStage(state) === 'posters');
  function save() { try { localStorage.setItem(FIGURE_STORAGE, JSON.stringify(state)); } catch { /* Continue without persistence. */ } }
  function sync() { onState(state, locale, { poster: viewingPosters(), coEdgeFocus, fedex, arrow, study }); }
  const wallCopy = () => WALL_LABELS[locale];
  const studyCopy = () => studyById(study).labels[locale];
  function achillesLine(stage) {
    const t = c();
    if (stage !== 'faces') return t.dialogue[0];
    if (coEdgeFocus === 'vase') return t.focusVaseLine;
    if (coEdgeFocus === 'faces') return t.dialogue[1];
    return t.bridge;
  }
  function setCoEdgeFocus(value) {
    if (fedex || figureStage(state) !== 'faces' || viewingPosters()) return false;
    coEdgeFocus = value;
    if (!state.observed) { state = { ...restoreFigureState(state), observed: true }; save(); }
    sync();
    render();
    onAnnounce(coEdgeFocus === 'vase' ? c().focusVaseLine : coEdgeFocus === 'faces' ? c().dialogue[1] : c().bridge);
    return true;
  }
  function render(focus) {
    const f = wallCopy(), plate = studyCopy(), art = studyById(study).art;
    const t = c(), label = ART_LABELS[locale], rubin = RUBIN_LABELS[locale], stage = figureStage(state), isPoster = viewingPosters();
    const retainedFocus = root.contains(document.activeElement) ? document.activeElement.id : null;
    const actor = !isPoster && stage === 'ground' ? 'tortoise' : 'achilles';
    const actions = figureNavigation(state,{poster:isPoster,fedex});
    const primary = [actions.primary, {arrow:arrow?f.reset:f.look,fedex:f.to,ground:t.look,next:t.throughGap}[actions.primary]];
    const studies = fedex ? `<div class="figure-studies" role="group" aria-label="${f.alt}">${STUDY_ORDER.map((id) => `<button type="button" id="fg-study-${id}" data-fg="study-${id}" aria-pressed="${study === id}">${studyById(id).labels[locale].short}</button>`).join('')}</div>` : '';
    const coEdge = stage === 'faces' && !isPoster && !fedex ? `<div class="figure-coedge" role="group" aria-label="${t.coEdgeLabel}">
        <button type="button" class="figure-coedge-hit" id="fg-focus-vase" data-fg="focus-vase" aria-pressed="${coEdgeFocus === 'vase'}">${t.focusVase}</button>
        <button type="button" class="figure-coedge-hit" id="fg-focus-faces" data-fg="focus-faces" aria-pressed="${coEdgeFocus === 'faces'}">${t.focusFaces}</button>
      </div>` : '';
    root.dataset.step = stage;
    root.dataset.poster = String(isPoster);
    root.dataset.contour = String(!isPoster && !fedex);
    root.dataset.fedex = String(fedex);
    root.dataset.arrow = String(arrow);
    root.dataset.study = fedex ? study : '';
    root.dataset.coedge = coEdgeFocus ?? '';
    root.innerHTML = `<header class="figure-heading"><p>${t.eyebrow}</p><h2 id="figure-title" tabindex="-1">${t.title}</h2>${!fedex && state.observed && stage === 'faces' ? `<p class="figure-observed" aria-hidden="true">${t.observed}</p>` : ''}</header>
      <div class="figure-fallback" aria-hidden="true" ${isPoster || fedex ? 'hidden' : ''}><img src="assets/art/rubin-contour.svg" alt=""></div>
      ${coEdge}
      ${fedex ? `<div class="figure-fedex-fallback" data-focus="${study}" role="img" aria-label="${arrow ? plate.revealed : plate.alt}">${negativeSpaceSVG({ revealed: arrow, focus: typeof innerWidth === 'number' && innerWidth <= 760 ? study : null })}</div>` : ''}
      ${!fedex && !isPoster && actor !== 'tortoise' ? `<div class="figure-reading">
        <div class="dialogue figure-dialogue" aria-live="polite" aria-atomic="true"><span class="speaker">${COPY[locale].actors[actor]}</span><p>${achillesLine(stage)}</p></div>
      </div>` : ''}
      <div class="figure-action"><button class="figure-primary" id="fg-primary" data-fg="${primary[0]}" ${fedex ? `aria-pressed="${arrow}"` : ''}>${primary[1]} <span aria-hidden="true">${primary[0] === 'poster' ? '←' : '→'}</span></button>${fedex ? `<button class="figure-link" id="fg-contour" data-fg="to-contour">${t.toContour} →</button>` : ''}</div>
      <aside class="figure-notes">
        ${fedex ? `<section class="figure-note-copy figure-art-label" aria-label="${plate.title}">
          ${studies}
          <p class="figure-art-title">${plate.title}<span>${art.year}</span></p>
          <p class="figure-art-designer">${art.designer}<small>${plate.role}</small></p>
          <p aria-live="polite">${arrow ? plate.revealed : plate.text}</p>
          ${arrow ? `<p class="figure-study-label">${plate.annotation}</p>` : ''}
          <a class="book-link" href="${art.source}" target="_blank" rel="noopener noreferrer">${plate.source}</a>
        </section><button class="figure-link" id="fg-poster" data-fg="poster">← ${t.toPosters}</button>` : !isPoster ? `<section class="figure-note-copy figure-art-label figure-rubin-label" aria-label="${rubin.title}">
          <p class="figure-art-title">${rubin.title}<span>${RUBIN_CREDIT.year}</span></p>
          <p class="figure-art-designer">${RUBIN_CREDIT.author}<small>${rubin.role}</small></p>
          <p>${rubin.text}</p>
          <a class="book-link" href="${RUBIN_CREDIT.source}" target="_blank" rel="noopener noreferrer">${rubin.source}</a>
        </section>${!isPoster ? `<button class="figure-link" id="fg-wall" data-fg="fedex">← ${f.to}</button>` : ''}` : `<section class="figure-note-copy figure-art-label" aria-label="${t.poster}">
          <div class="figure-poster-pair">${LOBSTER_POSTERS.map(art=>`<img class="figure-poster-fallback" src="${art.file}" width="${art.width}" height="${art.height}" alt="${label.title} · ${art.subject}">`).join('')}</div>
          <p class="figure-art-title">${label.title}<span>${LOBSTER_CREDIT.year}</span></p>
          <p class="figure-art-designer">${LOBSTER_CREDIT.designer}<small>${label.design}</small></p>
          <p>${t.posterText}</p>
          <div class="figure-art-sources">${LOBSTER_POSTERS.map((art,i)=>`<a class="book-link" href="${art.source}" target="_blank" rel="noopener noreferrer">${label.source} ${String(i+1).padStart(2,'0')} ↗</a>`).join('')}</div>
        </section>`}
      </aside>
      <dialog class="garden-dialog" id="fg-preview"><h3>${t.preview}</h3><button data-fg="close">${t.close}</button></dialog>`;
    if (active) {
      navigation.innerHTML = `<button id="fg-back" data-fg="back">${t.back}</button><button id="fg-next" data-fg="${actions.next}">${actions.next === 'next' ? LABYRINTH_COPY[locale].enterChapter : t.toExit} →</button>`;
      const target = focus || retainedFocus;
      if (target) (root.querySelector(`#${target}`) || navigation.querySelector(`#${target}`))?.focus({ preventScroll: true });
    }
  }
  function handle(event) {
    if (!active) return;
    const action = event.target.closest('[data-fg]')?.dataset.fg;
    if (!action) return;
    if (action === 'back') { onBack(); return; }
    if (action === 'next') { onNext(); return; }
    if (action === 'close') { root.querySelector('dialog').close(); navigation.querySelector('#fg-next')?.focus(); return; }
    if (action === 'focus-vase') { setCoEdgeFocus('vase'); return; }
    if (action === 'focus-faces') { setCoEdgeFocus('faces'); return; }
    if (action.startsWith('study-') && fedex) {
      const next = action.slice(6);
      if (!STUDY_ORDER.includes(next) || next === study) return;
      study = next; render(`fg-study-${study}`); sync(); onAnnounce(arrow ? studyCopy().revealed : studyCopy().text); return;
    }
    if (action === 'fedex') { state=advanceFigure(state,'to-wall');save();fedex = true; arrow = false; study = 'fedex'; poster = false; coEdgeFocus = null; render('fg-primary'); sync(); onAnnounce(studyCopy().text); return; }
    if (action === 'arrow' && fedex) { arrow = !arrow; render('fg-primary'); sync(); onAnnounce(arrow ? studyCopy().revealed : studyCopy().text); return; }
    if (action === 'poster') { fedex = false; arrow = false; poster = true; coEdgeFocus = null; render('fg-primary'); sync(); onAnnounce(c().toPosters); return; }
    if (action === 'to-contour') {
      fedex = false; arrow = false;
      state = advanceFigure(state, action); poster = false; coEdgeFocus = null; save(); render('fg-primary'); sync(); onAnnounce(c().toContour); return;
    }
    const before = figureStage(state);
    state = advanceFigure(state, action);
    if (before === figureStage(state)) return;
    if (before === 'faces') coEdgeFocus = null;
    save(); render('fg-primary'); sync(); onAnnounce(RUBIN_LABELS[locale].title);
  }
  root.addEventListener('click', handle); navigation.addEventListener('click', handle);
  return {
    show() { active = true; root.hidden = false; render('figure-title'); sync(); onAnnounce(c().eyebrow); },
    hide() { active = false; root.querySelector('dialog')?.close(); root.hidden = true; },
    setLocale(value) { locale = value; render(); if (active) sync(); },
    getState: () => state,
    showContour() { fedex=false;arrow=false;poster=false;state=advanceFigure(state,'to-contour');coEdgeFocus=null;save();render();sync(); },
    dismiss() { if(fedex){fedex=false;arrow=false;poster=figureStage(state)==='marks';render('fg-primary');sync();return true;} if (!poster || figureStage(state)==='marks') return false; poster = false; render('fg-primary'); sync(); return true; },
    talk(id) { onMeet(id); if (id === 'achilles') onAnnounce(fedex ? (arrow ? studyCopy().revealed : studyCopy().text) : achillesLine(viewingPosters() ? 'posters' : figureStage(state))); },
    showPoster() { if (viewingPosters()) return; fedex=false;arrow=false;poster = true; coEdgeFocus = null; render('fg-primary'); sync(); },
    showFedex(hit) {
      const next = STUDY_ORDER.includes(hit) ? hit : study;
      if (!fedex) { state=advanceFigure(state,'to-wall');save();fedex = true; arrow = false; study = next; }
      else if (STUDY_ORDER.includes(hit) && hit !== study) study = hit;
      else arrow = !arrow;
      poster = false; coEdgeFocus = null; render('fg-primary'); sync();
      onAnnounce(arrow ? studyCopy().revealed : studyCopy().text);
    },
    pickCoEdge(pointer, camera, scene) {
      const mode = scene?.pickCoEdge(pointer, camera);
      return mode ? setCoEdgeFocus(mode) : false;
    },
  };
}
