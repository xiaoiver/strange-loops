// Original exhibition translations, not quotations from a published GEB edition.
const format = (text, ...values) => text.replace(/\{(\d+)\}/g, (_, i) => String(values[Number(i)]));
const dialogueActors = { free: 'achilles', G: 'achilles', E: 'tortoise', B: 'achilles', drag: 'tortoise', achilles: 'achilles', tortoise: 'tortoise' };
const gardenActors = { opening: 'tortoise', challenge: 'tortoise', understood: 'achilles', understoodTortoise: 'tortoise', observeAchilles: 'achilles', r1: 'achilles', r2: 'achilles', r3: 'tortoise', r4: 'achilles', choice: 'tortoise', back: 'tortoise', long: 'achilles', hypothesis: 'tortoise', practice: 'achilles', achilles: 'achilles', tortoise: 'tortoise', noU: 'achilles', hasChoice: 'tortoise' };

export function exhibitionCopy(data) {
  const { plates, intro, bookLabel, dialogues, index, lightActions, status, ...copy } = data;
  const letterNames = Object.fromEntries([...('ABCDEFGHIJKLMNOPQRSTUVWXYZ')].map((key, i) => [key, plates[i]]));
  const book = `<a class="book-link" href="https://en.wikipedia.org/wiki/G%C3%B6del,_Escher,_Bach" target="_blank" rel="noopener noreferrer" aria-label="${bookLabel}" title="${bookLabel}">GEB</a>`;
  return {
    ...copy, viewLabel: copy.a11y.views,
    viewAria: Object.fromEntries(['G', 'E', 'B'].map(key => [key, `${key} · ${letterNames[key]}: ${copy.directions[key]}`])),
    letterNames, names: { G: letterNames.G, E: letterNames.E, B: letterNames.B },
    actors: { achilles: letterNames.A, tortoise: letterNames.T },
    intro: intro.replace('{book}', book),
    dialogues: Object.fromEntries(Object.entries(dialogues).map(([key, text]) => [key, [dialogueActors[key], key === 'G' ? letter => format(text, letter) : text]])),
    index: { ...index, note: `${index.note}<br>${letterNames.A}: <a class="book-link" href="https://sketchfab.com/3d-models/style-fortnite-creative-mannequin-5da12762b03a40078e21e51a1e185e8c" target="_blank" rel="noopener noreferrer">STYLE Fortnite-creative-mannequin</a> · POLLO28 · <a class="book-link" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a> (${index.adapted}).` },
    lightAria: (letter, on) => format(lightActions[on ? 1 : 0], letter),
    status: {
      ...status,
      view: letter => letter === 'free' ? status.viewFree : format(status.view, letter),
      light: (letter, on) => format(status.light[on ? 1 : 0], letter),
      ...Object.fromEntries(['companionSelected', 'sculptureGenerating', 'sculptureReady', 'sculptureExportReady'].map(key => [key, value => format(status[key], value)])),
    },
  };
}

export function gardenCopy(data) {
  return {
    ...data,
    examples: ['xI → xIU', 'Mx → Mxx', 'xIIIy → xUy', 'xUUy → xy'],
    ruleRemainders: ['1 → 1; 2 → 2', '1 → 2; 2 → 1', '1 → 1; 2 → 2', '1 → 1; 2 → 2'],
    ...Object.fromEntries(['nudge', 'liveCount', 'groupsNote'].map(key => [key, (...values) => format(data[key], ...values)])),
    lines: Object.fromEntries(Object.entries(data.lines).map(([key, text]) => [key, [gardenActors[key], text]])),
  };
}
