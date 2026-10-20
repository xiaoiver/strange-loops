import { occurrences } from './miu-system.js';

// A suggestion to explore, never a promise that the unreachable target is closer.
export function gardenHint(word, practice, selected) {
  if (practice && word === 'MUIU') return { key: 'complete' };
  if (selected) return { key: practice && selected === 3 && ['MIIII', 'MIIIIU'].includes(word) ? 'frontGroup' : 'choose' };
  if (word.length > 24) return { key: 'shorter' };
  if (practice) {
    if (['MI', 'MII'].includes(word)) return { key: 'copyPractice', rule: 2 };
    if (['MIIII', 'MUI'].includes(word)) return { key: 'addPractice', rule: 1 };
    if (word === 'MIIIIU') return { key: 'replacePractice', rule: 3 };
    return { key: 'detour' };
  }
  if (occurrences(word, 4).length) return { key: 'remove', rule: 4 };
  if (occurrences(word, 3).length) return { key: 'replace', rule: 3 };
  return { key: 'copy', rule: 2 };
}
