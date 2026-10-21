import { loading as ja } from './locales/ja.js';
import { loading as ko } from './locales/ko.js';
import { loading as fr } from './locales/fr.js';
import { loading as de } from './locales/de.js';
import { loading as es } from './locales/es.js';

export const LOADING_COPY = {
  zh: { app: '正在加载展厅', sculpture: '正在加载雕塑', companions: '正在加载同行者', custom: '正在生成字母', ready: '加载完成', slow: '仍在加载，请稍等。', failed: '无法加载，请重试。', retry: '重新加载' },
  en: { app: 'Loading the exhibition', sculpture: 'Loading the sculpture', companions: 'Loading your companions', custom: 'Generating the letters', ready: 'Ready to enter', slow: 'Still loading. Please wait.', failed: 'Unable to load. Please try again.', retry: 'Reload' },
  ja, ko, fr, de, es,
};
