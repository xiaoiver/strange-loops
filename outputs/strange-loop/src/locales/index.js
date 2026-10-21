import * as ja from './ja.js';
import * as ko from './ko.js';
import * as fr from './fr.js';
import * as de from './de.js';
import * as es from './es.js';
import { exhibitionCopy, gardenCopy } from './shared.js';

export const TRANSLATIONS = { ja, ko, fr, de, es };
export const EXHIBITION_TRANSLATIONS = Object.fromEntries(Object.entries(TRANSLATIONS).map(([key, value]) => [key, exhibitionCopy(value.copy)]));
export const GARDEN_TRANSLATIONS = Object.fromEntries(Object.entries(TRANSLATIONS).map(([key, value]) => [key, gardenCopy(value.garden)]));
