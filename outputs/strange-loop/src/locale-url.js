import { supportedLocale as supported } from './languages.js';

export function initialLocale(search, saved, pageLocale) {
  return supported(new URLSearchParams(search).get('lang')) || supported(pageLocale) || supported(saved) || 'zh';
}

export function localeUrl(href, locale) {
  const url = new URL(href);
  url.searchParams.set('lang', supported(locale) || 'zh');
  return `${url.pathname}${url.search}${url.hash}`;
}
