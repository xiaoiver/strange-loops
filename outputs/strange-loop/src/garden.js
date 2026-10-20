import { createHistory, restoreHistory, appendStep, occurrences, rewriteRange, displayWord } from './miu-system.js';
import { gardenHint } from './garden-hints.js';
import { GARDEN_COPY } from './garden-copy.js';

const STORAGE = 'geb.garden.v1';

export function createGarden(root, { locale: initialLocale, navigation, onWord, onMeet, onExit, onAnnounce, onHighlight }) {
  let locale = initialLocale, history = createHistory(), notice = '';
  let practice = true, message = 'opening', helpOpen = false, helpLevel = 1;
  const seen = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
    if (saved) {
      history = restoreHistory(saved.history);
      // Introduce the guided goal once, while retaining existing derivations.
      practice = saved.uiVersion === 2 ? saved.practice === true : true;
      if (Array.isArray(saved.seen)) saved.seen.filter(k => typeof k === 'string').forEach(k => seen.add(k));
    }
  } catch { /* The puzzle also works without a saved session. */ }
  message = practice ? 'opening' : 'challenge';
  const c = () => GARDEN_COPY[locale];
  const word = () => history.nodes[history.current].word;
  const show = value => displayWord(value, locale);
  function preview(rule) {
    const range = rewriteRange(word(), rule, occurrences(word(), rule)[0]);
    onHighlight(range?.start ?? null, range?.length ?? 0);
  }
  function save() {
    try { localStorage.setItem(STORAGE, JSON.stringify({ history, practice, seen: [...seen], onboarded: true, uiVersion: 2 })); }
    catch { /* Saving is optional; keep interaction available. */ }
  }
  function speak(key, once = false) {
    if (once && seen.has(key)) return;
    seen.add(key); message = key; onMeet(c().lines[key][0]);
  }
  function talk(actor) {
    speak(actor === 'achilles' && !word().includes('U') ? 'noU' :
      actor === 'tortoise' && occurrences(word(), 3).length > 1 ? 'hasChoice' : actor);
    render(); save();
  }
  function syncScene(meta = {}) {
    onWord(word(), locale, { ...meta, target: practice ? 'MUIU' : 'MU' });
    onHighlight(null, 0);
  }
  function commit(rule, position) {
    const previous = word();
    try { appendStep(history, rule, position); }
    catch (error) {
      onHighlight(null, 0); notice = error.message === 'history-limit' ? 'historyLimit' : 'limit';
      render(); onAnnounce(c()[notice]); return;
    }
    speak(`r${rule}`, true);
    if (word().length > 24) speak('long', true);
    if (practice && word() === 'MUIU') speak('practice');
    const nextRule = practice ? gardenHint(word(), true, null).rule || rule : rule;
    notice = ''; save(); render(practice && word() === 'MUIU' ? 'g-challenge' : `g-rule-${nextRule}`);
    syncScene({ previous, rule, position });
    onAnnounce(`${c().applied} ${rule}: ${show(word())}`);
  }
  function back() {
    if (!history.current) return;
    history.current = history.nodes[history.current].parent; notice = '';
    speak('back', true); save(); render(history.current === 0 ? 'g-word' : 'g-back'); syncScene();
    onAnnounce(`${c().current}: ${show(word())}`);
  }
  function render(focusId) {
    root.classList.toggle('has-help', helpOpen);
    root.classList.toggle('practice-complete', practice && word() === 'MUIU');
    const activeId = (root.contains(document.activeElement) || navigation.contains(document.activeElement)) ? document.activeElement.id : null;
    const t = c(), current = word(), [speaker, line] = t.lines[message];
    const finished = practice && current === 'MUIU';
    const help = gardenHint(current, practice, null);
    const suggested = (practice || helpOpen) && helpLevel === 1 ? help.rule || 0 : 0;
    const count = current.split('I').length - 1;
    root.innerHTML = `
      <div class="garden-layout">
        <div class="garden-work">
          <header class="garden-heading"><p>${t.eyebrow}</p><h2 id="garden-title">${t.title}</h2><p class="garden-question">${practice ? t.practiceQuestion : t.question}</p></header>
          <div class="garden-controls">
            <div class="word-heading"><span>${t.current}</span><button id="g-help-toggle" data-action="help" aria-expanded="${helpOpen}" aria-controls="g-help">${helpOpen ? t.closeHelp : t.help}</button></div>
            <div class="current-word" id="g-word" tabindex="-1" aria-label="${t.current}: ${show(current)}">${show(current)}</div>
            <p class="garden-guidance">${finished ? t.practiceDone : suggested ? t.nudge(t.rules[suggested - 1]) : t.choose}</p>
            <aside id="g-help" class="garden-help" ${helpOpen ? '' : 'hidden'} aria-label="${t.help}">
              <p aria-live="polite">${practice || helpLevel === 1 ? t.helpText[help.key] : helpLevel === 2 ? t.helpCount(count) : t.proof}</p>
              ${!practice && helpLevel === 3 ? `<p class="hint-note">${t.distinction}</p>` : ''}
              ${!practice ? `<button id="g-help-more" data-action="${helpLevel < 3 ? 'help-more' : 'practice'}">${helpLevel === 1 ? t.moreHelp : helpLevel === 2 ? t.helpObserve : t.practice} →</button>` : ''}
            </aside>
            <div class="garden-rules" role="group" aria-label="${locale === 'zh' ? '四条改写规则' : 'Four rewrite rules'}">
              ${[1, 2, 3, 4].map(r => {
                const available = occurrences(current, r).length > 0;
                return `<button id="g-rule-${r}" data-rule="${r}" class="${suggested === r ? 'suggested' : ''}" aria-disabled="${!available}" aria-describedby="g-rule-note-${r}"><span class="rule-number">0${r}</span><span>${t.rules[r - 1]}</span><span id="g-rule-note-${r}" class="rule-reason">${available ? t.examples[r - 1] : t.reasons[r - 1]}</span></button>`;
              }).join('')}
              <div class="rule-feedback" aria-hidden="true">${[1, 2, 3, 4].map(r => `<span data-reason="${r}">${t.reasons[r - 1]}</span>`).join('')}</div>
            </div>
            ${notice || finished ? `<div class="rewrite-area" aria-live="polite">${notice ? `<p class="garden-limit" role="status">${t[notice]}</p>` : ''}${finished ? `<button id="g-challenge" class="garden-primary" data-action="challenge">${t.challenge} →</button>` : ''}</div>` : ''}
            <div class="garden-secondary">
              <button id="g-back" data-action="back" ${history.current === 0 ? 'disabled' : ''}>← ${t.back}</button>
              <button id="g-reset" data-action="reset">${t.reset}</button>
            </div>
          </div>
        </div>
        <aside class="garden-aside">
          <div class="garden-target"><span>${t.target}</span><div>${show(practice ? 'MUIU' : 'MU')}</div></div>
          <div class="garden-conversation"><div class="dialogue garden-dialogue" aria-live="polite" aria-atomic="true"><span class="speaker">${t[speaker]}</span><p>“${line}”</p></div></div>
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
      // The original rule is unchanged; the exhibit chooses its leftmost occurrence.
      if (matches.length) commit(rule, matches[0]);
      return;
    }
    switch (button.dataset.action) {
      case 'help': helpOpen = !helpOpen; if (helpOpen) onMeet('tortoise'); render('g-help-toggle'); break;
      case 'help-more': helpLevel = Math.min(3, helpLevel + 1); render(helpLevel < 3 ? 'g-help-more' : 'g-help-toggle'); break;
      case 'back': back(); break;
      case 'challenge':
      case 'practice':
        practice = button.dataset.action === 'practice'; history.current = 0; helpOpen = false; helpLevel = 1; notice = ''; message = practice ? 'opening' : 'challenge';
        save(); render('g-word'); syncScene(); onAnnounce(practice ? c().practiceQuestion : c().question); break;
      case 'next': openDialog('next'); break;
      case 'reset': openDialog('reset'); break;
      case 'close': root.querySelector('dialog').close(); break;
      case 'clear':
        history = createHistory(); notice = ''; practice = true; helpOpen = false; helpLevel = 1; seen.clear(); message = 'opening';
        root.querySelector('dialog').close(); save(); render('g-word'); syncScene(); break;
      case 'lobby': root.querySelector('dialog')?.close(); onExit(); break;
    }
  }
  function dismiss() {
    if (!helpOpen) return false;
    helpOpen = false; render('g-help-toggle'); return true;
  }
  root.addEventListener('click', handleClick);
  navigation.addEventListener('click', handleClick);
  for (const event of ['pointerover', 'focusin']) root.addEventListener(event, e => {
    const button = e.target.closest('[data-rule]');
    if (button) preview(Number(button.dataset.rule));
  });
  for (const event of ['pointerout', 'focusout']) root.addEventListener(event, e => {
    const button = e.target.closest('[data-rule]');
    if (button && !button.contains(e.relatedTarget)) onHighlight(null, 0);
  });
  return {
    show() { render(); syncScene(); root.querySelector('#g-word').focus({ preventScroll: true }); },
    setLocale(value) { locale = value; render(); syncScene(); },
    talk,
    dismiss,
  };
}
