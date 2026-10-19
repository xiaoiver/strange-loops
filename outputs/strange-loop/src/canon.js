// Original eight-second demonstration, not a recording or quotation of Bach.
export const CANON_SECONDS = 8;
const melody = Object.freeze([60, 64, 67, 69, 67, 64, 62, 64, 67, 64, 62, 60]);
export const canonNotes = Object.freeze([0, 1].flatMap(voice =>
  (voice ? [...melody].reverse() : melody).map((midi, index) =>
    Object.freeze({midi, voice, at: index * .5 + voice * 1.5, duration: .46}))));

export function createCanonPlayer(onUpdate, onEnd) {
  let context, sources = [], tick, deadline, generation = 0;
  function stop(reason = 'stopped') {
    generation++;
    clearInterval(tick); clearTimeout(deadline);
    const active = context; context = undefined;
    for (const source of sources) { try { source.stop(); } catch {} }
    sources = [];
    if (active) active.close().catch(() => {});
    onEnd(reason);
  }
  async function play() {
    const run = ++generation;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Web Audio unavailable');
      context = new Audio();
      const ctx = context;
      await ctx.resume();
      if (run !== generation) return;
      if (ctx.state !== 'running') throw new Error('Audio did not start');
      const master = ctx.createGain(); master.gain.value = .45; master.connect(ctx.destination);
      const voices = [-.25, .25].map(pan => {
        const channel = ctx.createStereoPanner(); channel.pan.value = pan; channel.connect(master); return channel;
      });
      const start = ctx.currentTime + .035;
      for (const note of canonNotes) {
        const at = start + note.at, envelope = ctx.createGain();
        envelope.gain.setValueAtTime(0, at);
        envelope.gain.linearRampToValueAtTime(.15, at + .012);
        envelope.gain.exponentialRampToValueAtTime(.0001, at + note.duration);
        envelope.connect(voices[note.voice]);
        // Brief, gently decaying notes with a quiet upper harmonic. No drone or loop.
        for (const [harmonic, volume] of [[1, 1], [2, .16]]) {
          const oscillator = ctx.createOscillator(), level = ctx.createGain();
          oscillator.type = 'sine'; oscillator.frequency.value = 440 * 2 ** ((note.midi - 69) / 12) * harmonic;
          level.gain.value = volume; oscillator.connect(level); level.connect(envelope);
          oscillator.start(at); oscillator.stop(at + note.duration + .02); sources.push(oscillator);
        }
      }
      const update = () => onUpdate(Math.min(CANON_SECONDS, Math.max(1, Math.ceil(CANON_SECONDS - (ctx.currentTime - start)))));
      update(); tick = setInterval(update, 150);
      deadline = setTimeout(() => stop('ended'), (CANON_SECONDS + .035) * 1000);
    } catch {
      if (run === generation) stop('error');
    }
  }
  return {play, stop};
}
