// Discovery is independent of string length or the number of failed attempts.
export const DISCOVERY_STAGES = ['count', 'groups', 'rules', 'complete'];
export function restoreDiscovery(value) {
  return DISCOVERY_STAGES.includes(value) ? value : 'count';
}
export function letterGroups(word) {
  const count = [...word].filter(letter => letter === 'I').length;
  return { count, groups: Math.floor(count / 3), remainder: count % 3 };
}
export function discoveryAnswer(stage, answer) {
  return stage === 'rules' && answer === 'invariant' ? 'complete' : stage;
}
