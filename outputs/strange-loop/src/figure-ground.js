import { ART_LABELS, LOBSTER_POSTERS, LOBSTER_CREDIT, RUBIN_LABELS, RUBIN_CREDIT } from './gallery-art.js';
import { FIGURE_COPY } from './figure-ground-copy.js';
import { COPY } from './copy.js';
import { GARDEN_COPY } from './garden-copy.js';
import { FIGURE_STORAGE, NUMBERS, initialFigureState, restoreFigureState, advanceFigure, figureStage, numberEvidence } from './figure-ground-system.js';

const stages = ['posters','faces','ground','numbers','eight','eleven','complete'];
export function createFigureGround(root, { locale: initialLocale, navigation, onState, onMeet, onBack, onLobby, onAnnounce }) {
  let locale = initialLocale, state = initialFigureState(), active = false, wrong = false, help = false, poster = false, exploring = false;
  try { state = restoreFigureState(JSON.parse(localStorage.getItem(FIGURE_STORAGE))); } catch { /* Storage is optional. */ }
  const c = () => FIGURE_COPY[locale];
  function save() { try { localStorage.setItem(FIGURE_STORAGE, JSON.stringify(state)); } catch { /* Continue without persistence. */ } }
  function sync() { onState(state, locale, { poster: poster || figureStage(state) === 'posters', explore: exploring }); }
  function render(focus) {
    const t = c(), label = ART_LABELS[locale], rubin = RUBIN_LABELS[locale], stage = figureStage(state), index = stages.indexOf(stage), numbers = index >= 3, viewingPosters = poster || stage === 'posters';
    const viewingContour = !viewingPosters && (exploring || ['faces','ground'].includes(stage)), showNumbers = numbers && !viewingPosters && !viewingContour;
    const retainedFocus = root.contains(document.activeElement) ? document.activeElement.id : null;
    const dialogueIndex = viewingContour && numbers ? 2 : index;
    const actor = ['achilles','achilles','tortoise','achilles','tortoise','tortoise','tortoise'][dialogueIndex];
    const primary = poster ? ['to-wall',t.toContour] : viewingContour && numbers ? ['resume-numbers',t.toNumbers] : index < 5 ? [['to-contour','ground','meaning','generate','check'][index],[t.toContour,t.look,t.toNumbers,t.generate,t.check][index]] : stage === 'complete' ? ['to-wall',t.toContour] : null;
    root.dataset.step = stage;
    root.dataset.poster = String(viewingPosters);
    root.dataset.contour = String(viewingContour);
    root.innerHTML = `<header class="figure-heading"><p>${stage === 'complete' ? t.completed : t.eyebrow}</p><h2 id="figure-title" tabindex="-1">${t.title}</h2></header>
      <div class="figure-fallback" aria-hidden="true" ${viewingContour ? '' : 'hidden'}><img src="assets/art/rubin-contour.svg" alt=""></div>
      <div class="figure-ground-data ${showNumbers ? '' : 'sr-only'}" aria-label="${t.title}" ${showNumbers ? '' : 'hidden'}>
        <div class="figure-number-list">${NUMBERS.map(n => {
          const evidence = numberEvidence(state, n), label = evidence.kind === 'composite' ? t.composite : evidence.kind === 'prime' ? t.prime : t.unknown;
          return `<span class="figure-number ${evidence.kind}"><b>${n}</b><small>${label}${evidence.product ? `: ${evidence.product.join(' × ')} = ${n}` : ''}</small></span>`;
        }).join('')}</div>
      </div>
      <div class="figure-reading" ${viewingPosters ? 'hidden' : ''}>
        <div class="dialogue figure-dialogue" aria-live="polite" aria-atomic="true"><span class="speaker">${COPY[locale].actors[actor]}</span><p>${t.dialogue[dialogueIndex]}</p></div>
        ${stage === 'ground' ? `<p class="figure-caption">${t.contact}</p>` : ''}
        ${numbers && !viewingContour ? `<div class="figure-legend">
          <span><i class="filled" aria-hidden="true"></i>${t.filledLegend}</span>
          <span><i aria-hidden="true"></i>${t.blankLegend}</span>
          ${state.check ? `<span><i class="checked" aria-hidden="true"></i>${t.checkedLegend}</span>` : ''}
        </div>${stage !== 'eight' ? `<p class="figure-caption">${stage === 'numbers' ? t.meaning : t.checked}</p>` : ''}` : ''}
        ${stage === 'eleven' && !viewingContour ? `<fieldset class="figure-check"><legend>${t.question}</legend><button id="fg-answer-right" data-fg="not-listed">${t.right}</button><button id="fg-answer-wrong" data-fg="blank-prime">${t.wrong}</button>${wrong ? `<p class="figure-feedback" role="status">${t.retry}</p>` : ''}</fieldset>` : ''}
        ${stage === 'complete' && !viewingContour ? `<p class="figure-end">${t.end}</p><button class="figure-link" id="fg-restart" data-fg="restart">${GARDEN_COPY[locale].reset}</button>` : ''}
      </div>
      <div class="figure-action">${primary ? `<button class="figure-primary" id="fg-primary" data-fg="${primary[0]}">${primary[1]} <span aria-hidden="true">→</span></button>` : ''}</div>
      <aside class="figure-notes">
        ${viewingContour ? `<section class="figure-note-copy figure-art-label figure-rubin-label" aria-label="${rubin.title}">
          <p class="figure-art-title">${rubin.title}<span>${RUBIN_CREDIT.year}</span></p>
          <p class="figure-art-designer">${RUBIN_CREDIT.author}<small>${rubin.role}</small></p>
          <p>${rubin.text}</p>
          <a class="book-link" href="${RUBIN_CREDIT.source}" target="_blank" rel="noopener noreferrer">${rubin.source}</a>
        </section>` : ''}
        ${!viewingContour && !viewingPosters && index >= 5 ? `<button class="figure-link" id="fg-why" data-fg="why" aria-expanded="${help}">${t.why}</button>` : ''}
        ${help && !viewingContour && !viewingPosters ? `<p class="figure-note-copy">${t.reason}</p>` : ''}
        ${state.posters && !viewingPosters ? `<button class="figure-link" id="fg-poster" data-fg="poster">${t.toPosters} ↗</button>` : ''}
        ${viewingPosters ? `<section class="figure-note-copy figure-art-label" aria-label="${t.poster}">
          <div class="figure-poster-pair">${LOBSTER_POSTERS.map(art=>`<img class="figure-poster-fallback" src="${art.file}" width="${art.width}" height="${art.height}" alt="${label.title} · ${art.subject}">`).join('')}</div>
          <p class="figure-art-title">${label.title}<span>${LOBSTER_CREDIT.year}</span></p>
          <p class="figure-art-designer">${LOBSTER_CREDIT.designer}<small>${label.design}</small></p>
          <p>${t.posterText}</p>
          <div class="figure-art-sources">${LOBSTER_POSTERS.map((art,i)=>`<a class="book-link" href="${art.source}" target="_blank" rel="noopener noreferrer">${label.source} ${String(i+1).padStart(2,'0')} ↗</a>`).join('')}</div>
        </section>` : ''}
      </aside>
      <dialog class="garden-dialog" id="fg-preview"><h3>${t.preview}</h3><button data-fg="close">${t.close}</button></dialog>`;
    if (active) {
      navigation.innerHTML = `<button id="fg-back" data-fg="back">${t.back}</button><button id="fg-next" data-fg="next">${t.next}</button>`;
      const target = focus || retainedFocus;
      if (target) (root.querySelector(`#${target}`) || navigation.querySelector(`#${target}`))?.focus({ preventScroll: true });
    }
  }
  function numbersStage(){return ['numbers','eight','eleven','complete'].includes(figureStage(state));}
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
      root.querySelector('dialog').close();state=initialFigureState();wrong=help=poster=exploring=false;save();render('fg-primary');sync();onAnnounce(c().eyebrow);return;
    }
    if (action === 'close') { const reset=root.querySelector('[data-fg="reset-confirm"]');root.querySelector('dialog').close();(reset?root.querySelector('#fg-restart'):navigation.querySelector('#fg-next'))?.focus();return; }
    if (action === 'why') { help = !help; render('fg-why'); return; }
    if (action === 'poster') { poster = true; exploring = help = false; render('fg-primary'); sync(); return; }
    if (action === 'to-wall') { poster = help = false; exploring = numbersStage(); render('fg-primary'); sync(); onAnnounce(c().toContour); return; }
    if (action === 'resume-numbers') { exploring = poster = help = false; render(figureStage(state)==='eleven'?'fg-answer-right':'fg-primary'); sync(); onAnnounce(c().toNumbers); return; }
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
    dismiss() {
      if (poster) { poster = help = false; exploring = numbersStage(); render('fg-primary'); sync(); return true; }
      if (exploring) { exploring = help = false; render(figureStage(state)==='eleven'?'fg-answer-right':'fg-primary'); sync(); return true; }
      if (help) { help = false; render('fg-why'); return true; }
      return false;
    },
    talk(id) { onMeet(id); onAnnounce(c().dialogue[stages.indexOf(figureStage(state))]); },
    showPoster() { if (!state.posters || poster || figureStage(state) === 'posters') return; poster = true; exploring = help = false; render('fg-primary'); sync(); },
  };
}
