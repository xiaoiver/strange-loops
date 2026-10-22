import { ART_LABELS, LOBSTER_POSTERS, LOBSTER_CREDIT, RUBIN_LABELS, RUBIN_CREDIT } from './gallery-art.js';
import { FIGURE_COPY } from './figure-ground-copy.js';
import { COPY } from './copy.js';
import { LABYRINTH_COPY } from './labyrinth-copy.js';
import { FIGURE_STORAGE, initialFigureState, restoreFigureState, advanceFigure, figureStage } from './figure-ground-system.js';

const stages = ['posters', 'faces', 'ground'];
export function createFigureGround(root, { locale: initialLocale, navigation, onState, onMeet, onBack, onNext, onAnnounce }) {
  let locale = initialLocale, state = initialFigureState(), active = false, poster = false;
  try { state = restoreFigureState(JSON.parse(localStorage.getItem(FIGURE_STORAGE))); } catch { /* Storage is optional. */ }
  const c = () => FIGURE_COPY[locale];
  const viewingPosters = () => poster || figureStage(state) === 'posters';
  function save() { try { localStorage.setItem(FIGURE_STORAGE, JSON.stringify(state)); } catch { /* Continue without persistence. */ } }
  function sync() { onState(state, locale, { poster: viewingPosters() }); }
  function render(focus) {
    const t = c(), label = ART_LABELS[locale], rubin = RUBIN_LABELS[locale], stage = figureStage(state), isPoster = viewingPosters();
    const retainedFocus = root.contains(document.activeElement) ? document.activeElement.id : null;
    const index = isPoster ? 0 : stages.indexOf(stage), actor = index === 2 ? 'tortoise' : 'achilles';
    const primary = isPoster ? ['to-contour', t.toContour] : stage === 'faces' ? ['ground', t.look] : ['poster', t.toPosters];
    root.dataset.step = stage;
    root.dataset.poster = String(isPoster);
    root.dataset.contour = String(!isPoster);
    root.innerHTML = `<header class="figure-heading"><p>${t.eyebrow}</p><h2 id="figure-title" tabindex="-1">${t.title}</h2></header>
      <div class="figure-fallback" aria-hidden="true" ${isPoster ? 'hidden' : ''}><img src="assets/art/rubin-contour.svg" alt=""></div>
      ${!isPoster && actor !== 'tortoise' ? `<div class="figure-reading">
        <div class="dialogue figure-dialogue" aria-live="polite" aria-atomic="true"><span class="speaker">${COPY[locale].actors[actor]}</span><p>${t.dialogue[index]}</p></div>
      </div>` : ''}
      <div class="figure-action"><button class="figure-primary" id="fg-primary" data-fg="${primary[0]}">${primary[1]} <span aria-hidden="true">${primary[0] === 'poster' ? '←' : '→'}</span></button></div>
      <aside class="figure-notes">
        ${!isPoster ? `<section class="figure-note-copy figure-art-label figure-rubin-label" aria-label="${rubin.title}">
          <p class="figure-art-title">${rubin.title}<span>${RUBIN_CREDIT.year}</span></p>
          <p class="figure-art-designer">${RUBIN_CREDIT.author}<small>${rubin.role}</small></p>
          <p>${rubin.text}</p>
          <a class="book-link" href="${RUBIN_CREDIT.source}" target="_blank" rel="noopener noreferrer">${rubin.source}</a>
        </section>${stage === 'faces' ? `<button class="figure-link" id="fg-poster" data-fg="poster">← ${t.toPosters}</button>` : ''}` : `<section class="figure-note-copy figure-art-label" aria-label="${t.poster}">
          <div class="figure-poster-pair">${LOBSTER_POSTERS.map(art=>`<img class="figure-poster-fallback" src="${art.file}" width="${art.width}" height="${art.height}" alt="${label.title} · ${art.subject}">`).join('')}</div>
          <p class="figure-art-title">${label.title}<span>${LOBSTER_CREDIT.year}</span></p>
          <p class="figure-art-designer">${LOBSTER_CREDIT.designer}<small>${label.design}</small></p>
          <p>${t.posterText}</p>
          <div class="figure-art-sources">${LOBSTER_POSTERS.map((art,i)=>`<a class="book-link" href="${art.source}" target="_blank" rel="noopener noreferrer">${label.source} ${String(i+1).padStart(2,'0')} ↗</a>`).join('')}</div>
        </section>`}
      </aside>
      <dialog class="garden-dialog" id="fg-preview"><h3>${t.preview}</h3><button data-fg="close">${t.close}</button></dialog>`;
    if (active) {
      navigation.innerHTML = `<button id="fg-back" data-fg="back">${t.back}</button><button id="fg-next" data-fg="next">${LABYRINTH_COPY[locale].enterChapter} →</button>`;
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
    if (action === 'poster') { poster = true; render('fg-primary'); sync(); onAnnounce(c().toPosters); return; }
    if (action === 'to-contour') {
      state = advanceFigure(state, action); poster = false; save(); render('fg-primary'); sync(); onAnnounce(c().toContour); return;
    }
    const before = figureStage(state);
    state = advanceFigure(state, action);
    if (before === figureStage(state)) return;
    save(); render('fg-primary'); sync(); onAnnounce(RUBIN_LABELS[locale].title);
  }
  root.addEventListener('click', handle); navigation.addEventListener('click', handle);
  return {
    show() { active = true; root.hidden = false; render('figure-title'); sync(); onAnnounce(c().eyebrow); },
    hide() { active = false; root.querySelector('dialog')?.close(); root.hidden = true; },
    setLocale(value) { locale = value; render(); if (active) sync(); },
    getState: () => state,
    showContour() { poster=false;state=advanceFigure(state,'to-contour');save();render();sync(); },
    dismiss() { if (!poster) return false; poster = false; render('fg-primary'); sync(); return true; },
    talk(id) { onMeet(id); if (id === 'achilles') onAnnounce(c().dialogue[viewingPosters() ? 0 : 1]); },
    showPoster() { if (viewingPosters()) return; poster = true; render('fg-primary'); sync(); },
  };
}
