import { createHistory, restoreHistory, appendStep, pathTo, occurrences, rewrite, rewriteRange, displayWord } from './miu-system.js';
import { gardenHint } from './garden-hints.js';
import { GARDEN_COPY } from './garden-copy.js';

const STORAGE = 'geb.garden.v1';
const shorten = word => word.length > 22 ? `${word.slice(0, 12)}…${word.slice(-7)}` : word;

export function createGarden(root, { locale: initialLocale, navigation, onWord, onMeet, onExit, onAnnounce, onHighlight }) {
  let locale = initialLocale, history = createHistory(), selected = null, notice = '';
  let historyOpen = false, observation = false, hint = 0, practice = true, message = 'opening';
  let storageAvailable = true, helpOpen = false, helpLevel = 1;
  const seen = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
    if (saved) {
      history = restoreHistory(saved.history);
      practice = saved.onboarded || history.nodes.length > 1 ? saved.practice === true : true;
      hint = [0, 1, 2, 3].includes(saved.hint) ? saved.hint : 0;
      if (Array.isArray(saved.seen)) saved.seen.filter(k => typeof k === 'string').forEach(k => seen.add(k));
    }
  } catch { storageAvailable = false; }
  const c = () => GARDEN_COPY[locale];
  const word = () => history.nodes[history.current].word;
  const show = value => displayWord(value, locale);
  function preview(rule, position = occurrences(word(), rule)[0]) {
    const range = rewriteRange(word(), rule, position);
    onHighlight(range?.start ?? null, range?.length ?? 0);
  }
  function restoreSelection() {
    if (selected) preview(selected);
    else onHighlight(null, 0);
  }
  function save() {
    try { localStorage.setItem(STORAGE, JSON.stringify({ history, practice, hint, seen: [...seen], onboarded: true })); }
    catch { storageAvailable = false; }
  }
  function speak(key, once = false) {
    if (once && seen.has(key)) return;
    seen.add(key);
    message = key;
    onMeet(c().lines[key][0]);
  }
  function talk(actor) {
    speak(actor === 'achilles' && !word().includes('U') ? 'noU' :
      actor === 'tortoise' && occurrences(word(), 3).length > 1 ? 'hasChoice' : actor);
    render(); save();
  }
  function syncScene(meta = {}) {
    onWord(word(), locale, { ...meta, target: practice ? 'MUIU' : 'MU', path: pathTo(history).map(n => n.word) });
    restoreSelection();
  }
  function commit(rule, position) {
    const previous = word();
    try { appendStep(history, rule, position); }
    catch (error) { selected = null; onHighlight(null, 0); notice = error.message === 'history-limit' ? 'historyLimit' : 'limit'; render(); onAnnounce(c()[notice]); return; }
    speak(`r${rule}`, true);
    if (word().length > 24) speak('long', true);
    if (practice && word() === 'MUIU') speak('practice');
    selected = null; notice = ''; save(); render(`g-rule-${rule}`);
    syncScene({ previous, rule, position });
    onAnnounce(`${c().applied} ${rule}: ${show(word())}`);
  }
  function go(id) {
    if (!history.nodes[id]) return;
    history.current = id; selected = null; notice = '';
    speak('back', true); save(); render('g-word'); syncScene();
    onAnnounce(`${c().current}: ${show(word())}`);
  }
  function render(focusId) {
    root.classList.toggle('has-notes', historyOpen);
    root.classList.toggle('has-help', helpOpen);
    root.classList.toggle('practice-complete', practice && word() === 'MUIU');
    root.classList.toggle('choosing-position', Boolean(selected));
    const activeId = (root.contains(document.activeElement) || navigation.contains(document.activeElement)) ? document.activeElement.id : null;
    const t = c(), current = word(), path = pathTo(history);
    const matches = selected ? occurrences(current, selected) : [];
    const count = current.split('I').length - 1;
    const countLabel = locale === 'zh' ? 'J' : 'I';
    const [speaker, line] = t.lines[message];
    const finished = practice && current === 'MUIU';
    const help = gardenHint(current, practice, selected);
    const suggested = helpOpen && helpLevel === 1 && help.rule ? help.rule : practice ? ({ MI: 2, MII: 2, MIIII: 1, MIIIIU: 3, MUI: 1 }[current] || 0) : 0;
    const nodeButton = n => `<button id="g-node-${n.id}" data-node="${n.id}" ${n.id === history.current ? 'aria-current="step"' : ''} title="${show(n.word)}"><span>${n.id === 0 ? t.axiom : `#${n.id} · ${t.rule} ${n.rule}`}</span><b>${show(shorten(n.word))}</b>${history.nodes.filter(child => child.parent === n.id).length > 1 ? '<i>⑂</i>' : ''}</button>`;
    root.innerHTML = `
      <div class="garden-layout">
        <div class="garden-work">
          <header class="garden-heading"><p>${t.eyebrow}</p><h2 id="garden-title">${t.title}</h2><p class="garden-question">${practice ? t.practiceQuestion : t.question}</p></header>
          <div class="garden-controls">
          <div class="word-heading"><span>${t.current}</span><span>${path.length === 1 ? t.axiom : `${t.step}${path.length - 1}${t.stepEnd}`}</span><button id="g-help-toggle" data-action="help" aria-expanded="${helpOpen}" aria-controls="g-help">${helpOpen ? t.closeHelp : t.help}</button></div>
          <div class="current-word" id="g-word" tabindex="-1" aria-label="${t.current}: ${show(current)}">${show(current)}</div>
          <p class="garden-guidance">${finished ? t.practiceDone : suggested ? t.nudge(t.rules[suggested - 1]) : t.choose}</p>
          <aside id="g-help" class="garden-help" ${helpOpen ? '' : 'hidden'} aria-label="${t.help}">
            <p aria-live="polite">${helpLevel === 1 || practice ? t.helpText[help.key] : t.helpCount(count)}</p>
            ${!practice ? `<button id="g-help-more" data-action="${helpLevel === 1 ? 'help-more' : 'help-observe'}">${helpLevel === 1 ? t.moreHelp : t.helpObserve} →</button>` : ''}
          </aside>
          <div class="garden-rules" role="group" aria-label="${locale === 'zh' ? '四条改写规则' : 'Four rewrite rules'}">
            ${[1, 2, 3, 4].map(r => {
              const available = occurrences(current, r).length > 0;
              return `<button id="g-rule-${r}" data-rule="${r}" class="${suggested === r ? 'suggested' : ''}" aria-pressed="${selected === r}" aria-disabled="${!available}" aria-describedby="g-rule-note-${r}"><span class="rule-number">0${r}</span><span>${t.rules[r - 1]}</span><span id="g-rule-note-${r}" class="rule-reason">${available ? t.examples[r - 1] : t.reasons[r - 1]}</span></button>`;
            }).join('')}
            <div class="rule-feedback" aria-hidden="true">${[1, 2, 3, 4].map(r => `<span data-reason="${r}">${t.reasons[r - 1]}</span>`).join('')}</div>
          </div>
          <div class="rewrite-area" aria-live="polite">
            ${selected ? `<p class="position-prompt">${t.choosePosition}</p><div class="occurrence-list">${matches.map(p => {
              const { start, length } = rewriteRange(current, selected, p);
              return `<button id="g-position-${p}" data-position="${p}" aria-label="${t.position}${p + 1}${t.positionEnd} → ${show(rewrite(current, selected, p))}"><span>${show(current.slice(0, start))}<mark>${show(current.slice(start, start + length))}</mark>${show(current.slice(start + length))}</span><b>→ ${show(shorten(rewrite(current, selected, p)))}</b></button>`;
            }).join('')}</div><button id="g-cancel" data-action="cancel">${t.cancel}</button>` : ''}
            ${notice ? `<p class="garden-limit" role="status">${t[notice]}</p>` : ''}
            ${finished ? `<button id="g-challenge" class="garden-primary" data-action="practice">${t.challenge} →</button>` : ''}
          </div>
          <div class="garden-secondary">
            <button id="g-back" data-action="back" ${history.current === 0 ? 'disabled' : ''}>← ${t.back}</button>
            <button id="g-history-toggle" data-action="history" aria-expanded="${historyOpen}" aria-controls="g-history">${t.history} <span>${history.nodes.length}</span></button>

          </div>
          <section id="g-history" class="garden-history" ${historyOpen ? '' : 'hidden'} aria-label="${t.history}">
            <p>${t.historyHelp}</p><div class="derivation-path" aria-label="${t.route}">${path.map(nodeButton).join('')}</div>
            ${history.nodes.some(n => n.parent === history.current) ? `<p>${t.branches}</p><div class="derivation-path">${history.nodes.filter(n => n.parent === history.current).map(nodeButton).join('')}</div>` : ''}
            <button id="g-observe-toggle" data-action="observe" aria-expanded="${observation}" aria-controls="g-observation">${t.observe} →</button>
            <button id="g-practice" data-action="practice">${practice ? t.challenge : t.practice} →</button>
            <div class="history-bottom"><span>${storageAvailable ? t.saved : ''}</span><button id="g-reset" data-action="reset">${t.reset}</button></div>
          </section>
          <section id="g-observation" class="garden-observation" ${observation ? '' : 'hidden'} aria-label="${t.observe}">
            <button id="g-hypothesis" data-action="hypothesis">${t.hypothesis} ↗</button>
            ${hint >= 1 ? `<p>${t.hintOne}</p><div class="count-trail">${path.slice(-12).map(n => `<span title="${show(n.word)}">${n.word.split('I').length - 1}</span>`).join('<i>→</i>')}</div><p>${t.count} <strong>${count}</strong></p>` : ''}
            ${hint >= 2 ? `<p>${t.hintTwo}</p><div class="i-groups" aria-label="${Math.floor(count / 3)} × 3 + ${count % 3}">${Array.from({ length: Math.floor(count / 3) }, () => `<span>${countLabel.repeat(3)}</span>`).join('')}<b>${countLabel.repeat(count % 3)}</b></div><p>${count % 3} ${t.remainder}</p>` : ''}
            ${hint === 3 ? `<p class="garden-proof">${t.proof}</p><p>${t.distinction}</p>` : `<button id="g-clue" class="clue-link" data-action="clue">${[t.clue, t.group, t.explain][hint]} →</button>`}
            <p class="rule-footnote">${t.ruleHint}</p>
          </section>
          </div>
        </div>
        <aside class="garden-aside">
          <div class="garden-target"><span>${t.target}</span><div>${practice ? show('MUIU') : show('MU')}</div>
</div>
          <div class="garden-conversation">
            <div class="dialogue garden-dialogue" aria-live="polite" aria-atomic="true"><span class="speaker">${t[speaker]}</span><p>“${line}”</p></div>
          </div>
        </aside>
      </div>
      <dialog class="garden-dialog" id="g-dialog" aria-labelledby="g-dialog-title"></dialog>`;
    navigation.setAttribute('aria-label', locale === 'zh' ? '章节导航' : 'Chapter navigation');
    navigation.innerHTML = `<button id="back-lobby" data-action="lobby">${t.lobby}</button><button id="g-next" data-action="next">${t.next} →</button>`;
    const focus = focusId || activeId;
    if (focus) (root.querySelector(`#${focus}`) || navigation.querySelector(`#${focus}`))?.focus({ preventScroll: true });
  }
  function openDialog(kind) {
    const t = c(), dialog = root.querySelector('#g-dialog');
    dialog.innerHTML = kind === 'reset' ?
      `<h3 id="g-dialog-title">${t.resetTitle}</h3><p>${t.resetText}</p><div><button data-action="close">${t.keep}</button><button class="garden-primary" data-action="clear">${t.clear}</button></div>` :
      `<p class="dialog-eyebrow">${t.next}</p><h3 id="g-dialog-title">${t.nextTitle}</h3><p>${t.nextText}</p><p>${t.forthcoming}</p><div><button class="garden-primary" data-action="close">${t.resume}</button><button data-action="lobby">${t.lobby}</button></div>`;
    dialog.showModal();
  }
  function handleClick(e) {
    const button = e.target.closest('button');
    if (!button) return;
    if (button.dataset.rule) {
      const rule = Number(button.dataset.rule), matches = occurrences(word(), rule);
      if (!matches.length) return;
      if (matches.length === 1) { commit(rule, matches[0]); return; }
      selected = rule; notice = ''; speak('choice', true); render();
      preview(rule, matches[0]); return;
    }
    if (button.dataset.position && selected) { commit(selected, Number(button.dataset.position)); return; }
    if (button.dataset.node) { go(Number(button.dataset.node)); return; }
    switch (button.dataset.action) {
      case 'help': helpOpen = !helpOpen; if (helpOpen) onMeet('tortoise'); render('g-help-toggle'); break;
      case 'help-more': helpLevel = 2; render('g-help-more'); break;
      case 'help-observe':
        helpOpen = false; selected = null; onHighlight(null, 0); historyOpen = true; observation = true; hint = Math.max(1, hint);
        save(); render('g-observe-toggle'); root.querySelector('#g-observation').scrollIntoView({ block: 'nearest' }); break;
      case 'cancel': cancelSelection(); break;
      case 'back': if (history.current) go(history.nodes[history.current].parent); break;
      case 'history': historyOpen = !historyOpen; if (!historyOpen) observation = false; render(); break;
      case 'observe': observation = !observation; render(); break;
      case 'hypothesis': speak('hypothesis'); render(); break;
      case 'clue': hint = Math.min(3, hint + 1); save(); render(hint === 3 ? 'g-observe-toggle' : 'g-clue'); break;
      case 'practice': practice = !practice; helpLevel = 1; helpOpen = false; selected = null; notice = ''; save(); render('g-word'); syncScene(); break;
      case 'next': openDialog('next'); break;
      case 'reset': openDialog('reset'); break;
      case 'close': root.querySelector('dialog').close(); break;
      case 'clear':
        history = createHistory(); selected = null; notice = ''; hint = 0; practice = true; helpOpen = false; helpLevel = 1; seen.clear(); message = 'opening';
        root.querySelector('dialog').close(); save(); render('g-word'); syncScene(); break;
      case 'lobby': root.querySelector('dialog')?.close(); onExit(); break;
    }
  }
  function cancelSelection() {
    const rule = selected;
    selected = null; onHighlight(null, 0); render(`g-rule-${rule}`);
  }
  function dismiss() {
    if (selected) { cancelSelection(); return true; }
    if (helpOpen) { helpOpen = false; render('g-help-toggle'); return true; }
    if (observation) { observation = false; render('g-observe-toggle'); return true; }
    if (historyOpen) { historyOpen = false; render('g-history-toggle'); return true; }
    return false;
  }
  root.addEventListener('click', handleClick);
  navigation.addEventListener('click', handleClick);
  for (const event of ['pointerover', 'focusin']) root.addEventListener(event, e => {
    const button = e.target.closest('[data-position], [data-rule]');
    if (!button) return;
    if (button.dataset.rule) preview(Number(button.dataset.rule));
    else if (selected) preview(selected, Number(button.dataset.position));
  });
  for (const event of ['pointerout', 'focusout']) root.addEventListener(event, e => {
    const button = e.target.closest('[data-position], [data-rule]');
    if (button && !button.contains(e.relatedTarget)) restoreSelection();
  });
  return {
    show() { render(); syncScene(); root.querySelector('#g-word').focus({ preventScroll: true }); },
    setLocale(value) { locale = value; render(); syncScene(); },
    talk,
    dismiss,
  };
}
