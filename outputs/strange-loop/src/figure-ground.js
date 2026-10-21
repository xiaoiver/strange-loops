import { FIGURE_COPY } from './figure-ground-copy.js';
import { COPY } from './copy.js';
import { GARDEN_COPY } from './garden-copy.js';
import { FIGURE_STORAGE, NUMBERS, initialFigureState, restoreFigureState, advanceFigure, figureStage, numberEvidence } from './figure-ground-system.js';

const stages = ['faces','ground','numbers','eight','eleven','complete'];
export function createFigureGround(root, { locale: initialLocale, navigation, onState, onMeet, onBack, onLobby, onAnnounce }) {
  let locale = initialLocale, state = initialFigureState(), active = false, wrong = false, help = false, poster = false, book = false, exploring = false;
  try { state = restoreFigureState(JSON.parse(localStorage.getItem(FIGURE_STORAGE))); } catch { /* Storage is optional. */ }
  const c = () => FIGURE_COPY[locale];
  function save() { try { localStorage.setItem(FIGURE_STORAGE, JSON.stringify(state)); } catch { /* Continue without persistence. */ } }
  function sync() { onState(state, locale, { poster, explore: exploring }); }
  function render(focus) {
    const t = c(), stage = figureStage(state), index = stages.indexOf(stage), numbers = index >= 2;
    const retainedFocus = root.contains(document.activeElement) ? document.activeElement.id : null;
    const actor = ['achilles','tortoise','achilles','tortoise','tortoise','tortoise'][index];
    root.dataset.step = stage;
    root.dataset.poster = String(poster);
    root.innerHTML = `<header class="figure-heading"><p>${stage === 'complete' ? t.completed : t.eyebrow}</p><h2 id="figure-title" tabindex="-1">${t.title}</h2></header>
      <div class="figure-fallback" aria-hidden="true" ${numbers ? 'hidden' : ''}><img src="assets/art/rubin-contour.svg" alt=""></div>
      <div class="figure-ground-data ${numbers ? '' : 'sr-only'}" aria-label="${t.title}" ${numbers ? '' : 'hidden'}>
        <div class="figure-number-list">${NUMBERS.map(n => {
          const evidence = numberEvidence(state, n), label = evidence.kind === 'composite' ? t.composite : evidence.kind === 'prime' ? t.prime : t.unknown;
          return `<span class="figure-number ${evidence.kind}"><b>${n}</b><small>${label}${evidence.product ? `: ${evidence.product.join(' × ')} = ${n}` : ''}</small></span>`;
        }).join('')}</div>
      </div>
      <div class="figure-reading" ${poster ? 'hidden' : ''}>
        <div class="dialogue figure-dialogue" aria-live="polite" aria-atomic="true"><span class="speaker">${COPY[locale].actors[actor]}</span><p>${t.dialogue[index]}</p></div>
        ${stage === 'ground' ? `<p class="figure-caption">${t.contact}</p>` : ''}
        ${numbers ? `<p class="figure-caption">${stage === 'numbers' ? t.meaning + ' 2 × 3 = 6' : stage === 'eight' ? '2 × 4 = 8' : t.checked}</p>` : ''}
        ${stage === 'eleven' ? `<fieldset class="figure-check"><legend>${t.question}</legend><button id="fg-answer-right" data-fg="not-listed">${t.right}</button><button id="fg-answer-wrong" data-fg="blank-prime">${t.wrong}</button>${wrong ? `<p class="figure-feedback" role="status">${t.retry}</p>` : ''}</fieldset>` : ''}
        ${stage === 'complete' ? `<p class="figure-end">${t.end}</p><button class="figure-link" id="fg-explore" data-fg="explore">${exploring ? t.rules : t.explore} ↗</button><button class="figure-link" id="fg-restart" data-fg="restart">${GARDEN_COPY[locale].reset}</button>` : ''}
      </div>
      <div class="figure-action">${index < 4 && !poster ? `<button class="figure-primary" id="fg-primary" data-fg="${['ground','meaning','generate','check'][index]}">${[t.look,t.rules,t.generate,t.check][index]} <span aria-hidden="true">→</span></button>` : ''}</div>
      <aside class="figure-notes">
        ${index < 2 ? `<button class="figure-link" id="fg-help" data-fg="help" aria-expanded="${help}">${t.help}</button>` : index >= 4 ? `<button class="figure-link" id="fg-why" data-fg="why" aria-expanded="${help}">${t.why}</button>` : ''}
        ${help ? `<p class="figure-note-copy">${numbers ? t.reason : t.contact}</p>` : ''}
        <button class="figure-link" id="fg-poster" data-fg="poster" aria-expanded="${poster}">${poster ? t.close + ' · ' : ''}${t.poster} ↗</button>
        ${poster ? `<div class="figure-note-copy"><img class="figure-poster-fallback" src="assets/art/the-lobster.jpg" width="718" height="1024" alt="${t.posterText}"><p>${t.posterText}</p><p>The Lobster (2015) · Vasilis Marmatakis</p><a class="book-link" href="https://origin.dazeddigital.com/film-tv/article/42750/1/yorgos-lanthimos-posters-the-favourite-lobster-vasilis-marmatakis-interview" target="_blank" rel="noopener noreferrer">${t.source}</a></div>` : ''}
        <button class="figure-link" id="fg-book" data-fg="book" aria-expanded="${book}">${t.book}</button>
        ${book ? `<p class="figure-note-copy">${t.bookText}</p>` : ''}
      </aside>
      <dialog class="garden-dialog" id="fg-preview"><h3>${t.preview}</h3><button data-fg="close">${t.close}</button></dialog>`;
    if (active) {
      navigation.innerHTML = `<button id="fg-back" data-fg="back">${t.back}</button><button id="fg-next" data-fg="next">${t.next}</button>`;
      const target = focus || retainedFocus;
      if (target) (root.querySelector(`#${target}`) || navigation.querySelector(`#${target}`))?.focus({ preventScroll: true });
    }
  }
  function handle(event) {
    if (!active) return;
    const action = event.target.closest('[data-fg]')?.dataset.fg;
    if (!action) return;
    if (action === 'back') { onBack(); return; }
    if (action === 'next') {
      const dialog=root.querySelector('dialog');dialog.innerHTML=`<h3>${c().preview}</h3><button data-fg="close">${c().close}</button>`;dialog.showModal();return;
    }
    if (action === 'restart') {
      const dialog=root.querySelector('dialog');dialog.innerHTML=`<h3>${GARDEN_COPY[locale].resetTitle}</h3><p>${c().title}</p><button data-fg="close">${c().close}</button><button data-fg="reset-confirm">${GARDEN_COPY[locale].reset}</button>`;dialog.showModal();return;
    }
    if (action === 'reset-confirm') {
      root.querySelector('dialog').close();state=initialFigureState();wrong=help=poster=book=exploring=false;save();render('fg-primary');sync();onAnnounce(c().eyebrow);return;
    }
    if (action === 'close') { const reset=root.querySelector('[data-fg="reset-confirm"]');root.querySelector('dialog').close();(reset?root.querySelector('#fg-restart'):navigation.querySelector('#fg-next'))?.focus();return; }
    if (action === 'help' || action === 'why') { help = !help; render(action === 'help' ? 'fg-help' : 'fg-why'); sync(); return; }
    if (action === 'poster') { poster = !poster; render('fg-poster'); sync(); return; }
    if (action === 'book') { book = !book; render('fg-book'); return; }
    if (action === 'explore') { exploring = !exploring; poster = false; render('fg-explore'); sync(); return; }
    const before = figureStage(state);
    if (action === 'blank-prime' && before === 'eleven') { wrong = true; render('fg-answer-wrong'); return; }
    state = advanceFigure(state, action);
    if (before === figureStage(state)) return;
    wrong = false; help = false; poster = false; save(); render(figureStage(state) === 'eleven' ? 'fg-answer-right' : 'fg-primary'); sync();
    if (figureStage(state) === 'complete') root.querySelector('#figure-title').focus({ preventScroll: true });
    onMeet(['ground','eight','eleven','complete'].includes(figureStage(state)) ? 'tortoise' : 'achilles');
    onAnnounce(figureStage(state) === 'complete' ? c().completed : c().dialogue[stages.indexOf(figureStage(state))]);
  }
  root.addEventListener('click', handle); navigation.addEventListener('click', handle);
  return {
    show() { active = true; root.hidden = false; render('figure-title'); sync(); onAnnounce(c().eyebrow); },
    hide() { active = false; root.querySelector('dialog')?.close(); root.hidden = true; },
    setLocale(value) { locale = value; render(); if (active) sync(); },
    getState: () => state,
    hintsVisible: () => help,
    dismiss() {
      if (poster) { poster = false; render('fg-poster'); sync(); return true; }
      if (book) { book = false; render('fg-book'); return true; }
      if (help) { help = false; render(figureStage(state) === 'faces' || figureStage(state) === 'ground' ? 'fg-help' : 'fg-why'); sync(); return true; }
      return false;
    },
    talk(id) { onMeet(id); onAnnounce(c().dialogue[stages.indexOf(figureStage(state))]); },
    showPoster() { poster = !poster; render('fg-poster'); sync(); },
  };
}
