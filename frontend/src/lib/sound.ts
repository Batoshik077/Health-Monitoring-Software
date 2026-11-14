let ctx: AudioContext | null = null;

/** Короткий двойной сигнал для критической тревоги. Браузер разрешает звук только после клика. */
export function beep(): void {
  try {
    ctx ??= new AudioContext();
    const now = ctx.currentTime;
    for (const offset of [0, 0.25]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.2);
    }
  } catch {
    /* звук недоступен — не страшно */
  }
}
