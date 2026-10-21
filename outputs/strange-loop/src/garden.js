import { createHistory, restoreHistory, appendStep, occurrences, rewriteRange, displayWord } from './miu-system.js';
import { gardenHint } from './garden-hints.js';
import { GARDEN_COPY } from './garden-copy.js';
import { restoreDiscovery, letterGroups, discoveryAnswer } from './garden-discovery.js';

const STORAGE = 'geb.garden.v1';

export function createGarden(root, { locale: initialLocale, navigation, onWord, onMeet, onExit, onAnnounce, onHighlight, onNext, nextLabel }) {
  let locale = initialLocale, history = createHistory(), notice = '';
  let practice = true, message = 'opening', helpOpen = false;
  let discovery = 'count', answerWrong = false, exploring = false, conversationOpen = false;
  const seen = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
    if (saved) {
      history = restoreHistory(saved.history);
      // Introduce the guided goal once, while retaining existing derivations.
      practice = [2, 3].includes(saved.uiVersion) ? saved.practice === true : true;
      discovery = restoreDiscovery(saved.discovery);
      if (discovery === 'complete') practice = false;
      if (Array.isArray(saved.seen)) saved.seen.filter(k => typeof k === 'string').forEach(k => seen.add(k));
    }
  } catch { /* The puzzle also works without a saved session. */ }
  message = practice ? 'opening' : discovery === 'complete' ? 'understood' : 'challenge';
  const c = () => ({ ...GARDEN_COPY[locale], next: nextLabel?.(locale) || GARDEN_COPY[locale].next });
  const word = () => history.nodes[history.current].word;
  const show = value => displayWord(value, locale);
  function preview(rule) {
    const range = rewriteRange(word(), rule, occurrences(word(), rule)[0]);
    onHighlight(range?.start ?? null, range?.length ?? 0);
  }
  function save() {
    try { localStorage.setItem(STORAGE, JSON.stringify({ history, practice, discovery, seen: [...seen], onboarded: true, uiVersion: 3 })); }
    catch { /* Saving is optional; keep interaction available. */ }
  }
  function speak(key, once = false) {
    if (once && seen.has(key)) return;
    seen.add(key); message = key; onMeet(c().lines[key][0]);
  }
  function talk(actor) {
    if (!practice) {
      const key = discovery === 'complete' ? (actor === 'achilles' ? 'understood' : 'understoodTortoise') : (actor === 'achilles' ? 'observeAchilles' : 'challenge');
      speak(key); conversationOpen = true; render(); save(); return;
    }
    speak(actor === 'achilles' && !word().includes('U') ? 'noU' :
      actor === 'tortoise' && occurrences(word(), 3).length > 1 ? 'hasChoice' : actor);
    render(); save();
  }
  function syncScene(meta = {}) {
    onWord(word(), locale, { ...meta, target: practice ? 'MUIU' : 'MU' });
    onHighlight(null, 0);
  }
  function commit(rule, position) {
    if (!practice && (discovery === 'rules' || discovery === 'complete' && !exploring)) return;
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
    const reasoning = !practice && !exploring && ['rules', 'complete'].includes(discovery);
    root.classList.toggle('is-reasoning', reasoning);
    root.classList.toggle('is-discovering', !practice && !exploring);
    root.classList.toggle('has-conversation', conversationOpen);
    const activeId = (root.contains(document.activeElement) || navigation.contains(document.activeElement)) ? document.activeElement.id : null;
    const t = c(), current = word(), [speaker, line] = t.lines[message];
    const finished = practice && current === 'MUIU';
    const help = gardenHint(current, practice, null);
    const suggested = practice ? help.rule || 0 : 0;
    const { count, groups, remainder } = letterGroups(current);
    const completed = !practice && discovery === 'complete';
    const discoveryPanel = practice ? '' : exploring ? `<p class="discovery-caption">${t.completed}</p><button class="discovery-link" id="g-review" data-action="review">${t.review} →</button>` : `
      <section class="garden-discovery" aria-labelledby="g-discovery-title">
        <h3 id="g-discovery-title" tabindex="-1">${completed ? t.completedTitle : discovery === 'rules' ? t.rulesTitle : discovery === 'groups' ? t.groupsTitle : t.countTitle}</h3>
        ${completed ? `<p>${t.completedText}</p><p class="hint-note">${t.completedNote}</p>
          <button class="garden-primary" id="g-complete-next" data-action="next">${t.next} →</button>
          <button class="discovery-link" data-action="explore">${t.explore}</button>` : discovery === 'rules' ? `
          <p class="discovery-caption">${t.remainderLabel}</p>
          <table class="discovery-rules"><tbody>${[1, 2, 3, 4].map(rule => `<tr><th scope="row">${rule}. ${t.rules[rule - 1]}<small>${t.ruleEffects[rule - 1]}</small></th><td>${t.ruleRemainders[rule - 1]}</td></tr>`).join('')}</tbody></table>
          <p>${t.invariantNote}</p>
          <fieldset class="discovery-check"><legend>${t.checkTitle}</legend>
            <button id="g-answer-attempts" data-action="answer" data-answer="attempts">${t.answerAttempts}</button>
            <button id="g-answer-invariant" data-action="answer" data-answer="invariant">${t.answerInvariant}</button>
          </fieldset>${answerWrong ? `<p class="answer-feedback" role="status">${t.answerRetry}</p>` : ''}` : `
          <p class="discovery-count" aria-live="polite">${t.liveCount(count)}</p>
          ${discovery === 'groups' ? `<p class="discovery-equation" aria-label="${t.groupsNote(groups, remainder)}">${count} = 3 × ${groups} + <strong>${remainder}</strong></p><p>${t.groupsPrompt}</p>` : `<p>${t.countNote}</p>`}
          <button class="garden-primary" id="g-discovery-next" data-action="${discovery === 'groups' ? 'rules' : 'groups'}">${discovery === 'groups' ? t.rulesAction : t.groupAction} →</button>`}
      </section>`;
    root.innerHTML = `
      <div class="garden-layout">
        <div class="garden-work">
          <header class="garden-heading"><p>${completed ? t.completed : t.eyebrow}</p><h2 id="garden-title">${t.title}</h2><p class="garden-question" ${completed ? 'hidden' : ''}>${practice ? t.practiceQuestion : t.discoveryQuestion}</p></header>
          <div class="garden-controls">
            <div class="word-heading" ${reasoning ? 'hidden' : ''}><span>${t.current}</span>${practice ? `<button id="g-help-toggle" data-action="help" aria-expanded="${helpOpen}" aria-controls="g-help">${helpOpen ? t.closeHelp : t.help}</button>` : ''}</div>
            <div class="current-word" id="g-word" ${reasoning ? 'hidden' : ''} tabindex="-1" aria-label="${t.current}: ${show(current)}">${show(current)}</div>
            ${discoveryPanel}
            <p class="garden-guidance" ${!practice ? 'hidden' : ''}>${finished ? t.practiceDone : suggested ? t.nudge(t.rules[suggested - 1]) : t.choose}</p>
            <aside id="g-help" class="garden-help" ${helpOpen ? '' : 'hidden'} aria-label="${t.help}">
              <p aria-live="polite">${t.helpText[help.key]}</p>
            </aside>
            <div class="garden-rules" ${reasoning ? 'hidden' : ''} role="group" aria-label="${t.rulesLabel}">
              ${[1, 2, 3, 4].map(r => {
                const available = occurrences(current, r).length > 0;
                return `<button id="g-rule-${r}" data-rule="${r}" class="${suggested === r ? 'suggested' : ''}" aria-disabled="${!available}" aria-describedby="g-rule-note-${r}"><span class="rule-number">0${r}</span><span>${t.rules[r - 1]}</span><span id="g-rule-note-${r}" class="rule-reason">${available ? t.examples[r - 1] : t.reasons[r - 1]}</span></button>`;
              }).join('')}
              <div class="rule-feedback" aria-hidden="true">${[1, 2, 3, 4].map(r => `<span data-reason="${r}">${t.reasons[r - 1]}</span>`).join('')}</div>
            </div>
            ${notice || finished ? `<div class="rewrite-area" aria-live="polite">${notice ? `<p class="garden-limit" role="status">${t[notice]}</p>` : ''}${finished ? `<button id="g-challenge" class="garden-primary" data-action="challenge">${t.challenge} →</button>` : ''}</div>` : ''}
            <div class="garden-secondary" ${reasoning ? 'hidden' : ''}>
              <button id="g-back" data-action="back" ${history.current === 0 ? 'disabled' : ''}>← ${t.back}</button>
              <button id="g-reset" data-action="reset">${t.reset}</button>
            </div>
          </div>
        </div>
        <aside class="garden-aside">
          <div class="garden-target" ${completed ? 'hidden' : ''}><span>${t.target}</span><div>${show(practice ? 'MUIU' : 'MU')}</div></div>
          <div class="garden-conversation"><div class="dialogue garden-dialogue" aria-live="polite" aria-atomic="true"><span class="speaker">${t[speaker]}</span><p>“${line}”</p></div></div>
        </aside>
      </div>
      <dialog class="garden-dialog" id="g-dialog" aria-labelledby="g-dialog-title"></dialog>`;
    navigation.setAttribute('aria-label', t.navigationLabel);
    navigation.innerHTML = `<button id="back-lobby" data-action="lobby">${t.lobby}</button><button id="g-next" data-action="next">${t.next} →</button>`;
    const focus = focusId || activeId;
    if (focusId === 'g-discovery-title') root.scrollTop = 0;
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
      case 'back': back(); break;
      case 'challenge':
        practice = false;
        discovery = 'count'; exploring = false; answerWrong = false; conversationOpen = false;
        helpOpen = false; notice = ''; message = 'challenge';
        save(); render('g-discovery-title'); syncScene(); onAnnounce(c().discoveryQuestion); break;
      case 'groups':
      case 'rules':
        if (practice || discovery === 'complete') break;
        discovery = button.dataset.action; answerWrong = false; conversationOpen = false;
        onHighlight(null, 0); save(); render('g-discovery-title'); break;
      case 'answer': {
        if (practice || discovery !== 'rules') break;
        const next = discoveryAnswer(discovery, button.dataset.answer);
        answerWrong = next !== 'complete'; discovery = next; conversationOpen = false;
        if (!answerWrong) { speak('understood'); onAnnounce(c().completed); }
        save(); render(answerWrong ? 'g-answer-attempts' : 'g-discovery-title');
        if (answerWrong) root.querySelector('.answer-feedback').scrollIntoView({ block: 'nearest' });
        break;
      }
      case 'explore':
        if (discovery !== 'complete') break;
        exploring = true; render('g-word'); break;
      case 'review': exploring = false; render('g-discovery-title'); break;
      case 'next': if(onNext)onNext();else openDialog('next'); break;
      case 'reset': openDialog('reset'); break;
      case 'close': root.querySelector('dialog').close(); break;
      case 'clear':
        history = createHistory(); notice = ''; practice = true; discovery = 'count'; exploring = false; answerWrong = false; conversationOpen = false;
        helpOpen = false; seen.clear(); message = 'opening';
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
    show() { render(); syncScene(); root.querySelector(!practice && !exploring ? '#g-discovery-title' : '#g-word').focus({ preventScroll: true }); },
    setLocale(value) { locale = value; render(); syncScene(); },
    isComplete: () => discovery === 'complete',
    talk,
    dismiss,
  };
}
