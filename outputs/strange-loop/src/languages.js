export const LANGUAGES = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es'];

export function supportedLocale(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replaceAll('_', '-');
  // The Chinese translation is simplified; do not label it as traditional Chinese.
  if (['zh', 'zh-cn', 'zh-hans', 'zh-hans-cn'].includes(normalized)) return 'zh';
  const base = normalized.split('-')[0];
  return base !== 'zh' && LANGUAGES.includes(base) ? base : null;
}
