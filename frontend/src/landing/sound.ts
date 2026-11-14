/**
 * Звуковой дизайн лендинга. Всё синтезируется Web Audio API — без аудиофайлов.
 *
 *   гул космоса      — низкие осцилляторы + мягкий шум, звучат всё время
 *   dawn             — тёплый аккорд нарастает вместе с «восходом» над Землёй
 *   blip             — короткий телеметрический сигнал на каждой подписи
 *   свист пролёта    — фильтрованный шум: громкость и панорама от близости корабля к камере,
 *                      высота «съезжает» вниз, когда корабль удаляется (эффект Доплера)
 *   рокот двигателя  — низкочастотный шум, пока у «Союза» горит двигатель
 *   riser + impact   — нарастание перед подлётом к МКС и глухой удар в момент подлёта
 *   reveal           — светлый аккорд-«колокол» на финальном кадре
 *
 * Браузеры не разрешают звук без действия пользователя, поэтому enable() вызывается по клику.
 */
import type { AudioFrame, Cue } from "./scene";

type Voice = {
  gain: GainNode;
  filter: BiquadFilterNode;
  rumble: GainNode;
  pan: StereoPannerNode;
};

export class LandingSound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private reverbIn!: GainNode;
  private noise!: AudioBuffer;
  private drone!: GainNode;
  private voices: Voice[] = [];
  private suspendTimer = 0;
  /** Финал уже прозвучал — гул больше не поднимаем. */
  private finished = false;
  enabled = false;

  /** Включить звук. Вызывать из обработчика клика/нажатия. */
  async enable() {
    if (!this.ctx) this.build();
    const ctx = this.ctx!;
    window.clearTimeout(this.suspendTimer);
    this.enabled = true;
    if (ctx.state !== "running") await ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0.9, t, 0.25);
    this.drone.gain.cancelScheduledValues(t);
    this.drone.gain.setTargetAtTime(this.finished ? 0 : 0.13, t, 1.5);
  }

  disable() {
    this.enabled = false;
    const ctx = this.ctx;
    if (!ctx) return;
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
    this.suspendTimer = window.setTimeout(() => !this.enabled && ctx.suspend().catch(() => {}), 800);
  }

  dispose() {
    window.clearTimeout(this.suspendTimer);
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }

  // ---------- граф ----------
  private build() {
    const ctx = new AudioContext();
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(comp);

    // реверберация «пространства»: сгенерированный импульс 3.5 с
    const conv = ctx.createConvolver();
    conv.buffer = this.impulse(3.5, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    conv.connect(wet).connect(this.master);
    this.reverbIn = ctx.createGain();
    this.reverbIn.connect(conv);

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // гул: квинты на низах, фильтр медленно «дышит»
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = "lowpass";
    droneFilter.frequency.value = 320;
    droneFilter.Q.value = 0.8;
    this.drone = ctx.createGain();
    this.drone.gain.value = 0;
    droneFilter.connect(this.drone);
    this.out(this.drone, 0.6);
    [[55, "sine", 0.5], [82.4, "sine", 0.32], [110.3, "triangle", 0.18], [164.6, "sine", 0.08]].forEach(([f, type, g]) => {
      const o = ctx.createOscillator();
      o.type = type as OscillatorType;
      o.frequency.value = f as number;
      o.detune.value = (Math.random() - 0.5) * 8;
      const og = ctx.createGain();
      og.gain.value = g as number;
      o.connect(og).connect(droneFilter);
      o.start();
    });
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoAmt = ctx.createGain();
    lfoAmt.gain.value = 140;
    lfo.connect(lfoAmt).connect(droneFilter.frequency);
    lfo.start();
    // «воздух» — очень тихий шум
    const air = this.noiseSrc();
    const airF = ctx.createBiquadFilter();
    airF.type = "bandpass";
    airF.frequency.value = 600;
    airF.Q.value = 0.4;
    const airG = ctx.createGain();
    airG.gain.value = 0.012;
    air.connect(airF).connect(airG).connect(this.drone);

    // два голоса для кораблей: свист (полосовой шум) + рокот двигателя (НЧ-шум) с панорамой
    for (let i = 0; i < 2; i++) {
      const pan = ctx.createStereoPanner();
      this.out(pan, 0.25);
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 1.1;
      filter.frequency.value = 800;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      this.noiseSrc().connect(filter).connect(gain).connect(pan);
      const rf = ctx.createBiquadFilter();
      rf.type = "lowpass";
      rf.frequency.value = 150;
      const rumble = ctx.createGain();
      rumble.gain.value = 0;
      this.noiseSrc().connect(rf).connect(rumble).connect(pan);
      this.voices.push({ gain, filter, rumble, pan });
    }
  }

  private out(node: AudioNode, wet: number) {
    node.connect(this.master);
    const s = this.ctx!.createGain();
    s.gain.value = wet;
    node.connect(s).connect(this.reverbIn);
  }

  private noiseSrc() {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.loopStart = Math.random();
    s.start(0, Math.random() * 1.9);
    return s;
  }

  private impulse(seconds: number, decay: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  /** Тон с огибающей: атака → экспоненциальное затухание. */
  private tone(freq: number, at: number, attack: number, decay: number, peak: number, type: OscillatorType, wet: number, dest?: AudioNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    o.connect(g);
    if (dest) g.connect(dest);
    else this.out(g, wet);
    o.start(at);
    o.stop(at + attack + decay + 0.1);
    return o;
  }

  // ---------- события ----------
  cue(cue: Cue) {
    const ctx = this.ctx;
    if (!this.enabled || !ctx) return;
    const t = ctx.currentTime + 0.01;

    if (cue === "dawn") {
      // тёплый аккорд A-мажор раскрывается вместе со светом
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(350, t);
      lp.frequency.exponentialRampToValueAtTime(2200, t + 5);
      this.out(lp, 0.7);
      [110, 164.8, 220, 277.2, 329.6].forEach((f, i) => {
        for (const det of [-4, 4]) {
          const o = this.tone(f, t + i * 0.25, 3.2, 6.5, 0.022, "sawtooth", 0, lp);
          o.detune.value = det;
        }
      });
    }

    if (cue === "blip") {
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 600;
      this.out(hp, 0.45);
      this.tone(1318.5, t, 0.005, 0.12, 0.05, "sine", 0, hp);
      this.tone(1760, t + 0.09, 0.005, 0.18, 0.04, "sine", 0, hp);
    }

    if (cue === "riser") {
      const dur = 1.85;
      const n = this.noiseSrc();
      const hp = ctx.createBiquadFilter();
      hp.type = "bandpass";
      hp.Q.value = 2;
      hp.frequency.setValueAtTime(250, t);
      hp.frequency.exponentialRampToValueAtTime(5000, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + dur);
      g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
      n.connect(hp).connect(g);
      this.out(g, 0.4);
      setTimeout(() => n.stop(), (dur + 0.5) * 1000);
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(55, t);
      o.frequency.exponentialRampToValueAtTime(220, t + dur);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 700;
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.07, t + dur);
      og.gain.linearRampToValueAtTime(0, t + dur + 0.05);
      o.connect(lp).connect(og);
      this.out(og, 0.3);
      o.start(t);
      o.stop(t + dur + 0.1);
    }

    if (cue === "impact") {
      // саб-удар: синус падает по высоте + короткий шумовой «удар»
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(72, t);
      o.frequency.exponentialRampToValueAtTime(30, t + 1.5);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.75, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      o.connect(g);
      this.out(g, 0.5);
      o.start(t);
      o.stop(t + 2.5);
      const n = this.noiseSrc();
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 500;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.3, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      n.connect(lp).connect(ng);
      this.out(ng, 0.6);
      setTimeout(() => n.stop(), 1200);
    }

    if (cue === "reveal") {
      // светлый аккорд-«колокол» с перебором
      [220, 329.6, 440, 554.4, 659.3, 880].forEach((f, i) => {
        this.tone(f, t + i * 0.07, 0.015, 5.5, 0.045, "sine", 0.75);
        this.tone(f * 2.01, t + i * 0.07, 0.01, 2.2, 0.012, "sine", 0.75);
      });
      // гул коротко поддерживает аккорд и плавно уходит в тишину (~6 с) — в финале звучит только «колокол»
      this.finished = true;
      this.drone.gain.cancelScheduledValues(t);
      this.drone.gain.setTargetAtTime(0.16, t, 0.4);
      this.drone.gain.setTargetAtTime(0, t + 1.5, 1.6);
    }

    if (cue === "depart") {
      // переход в бортовой компьютер: нарастающий «взлёт» шума + мягкий аккорд, затем всё затихает
      const dur = 1.6;
      const n = this.noiseSrc();
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 1.4;
      bp.frequency.setValueAtTime(300, t);
      bp.frequency.exponentialRampToValueAtTime(6000, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.28, t + dur * 0.8);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);
      n.connect(bp).connect(g);
      this.out(g, 0.5);
      setTimeout(() => n.stop(), (dur + 1) * 1000);
      [440, 659.3, 880].forEach((f, i) => this.tone(f, t + 0.9 + i * 0.08, 0.02, 1.8, 0.03, "sine", 0.7));
      this.drone.gain.cancelScheduledValues(t);
      this.drone.gain.setTargetAtTime(0, t, 0.3);
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(0, t + 1.6, 0.35); // к моменту перехода — тишина
    }
  }

  /** Каждый кадр: свист и рокот кораблей по их близости к камере. */
  update(f: AudioFrame) {
    const ctx = this.ctx;
    if (!this.enabled || !ctx) return;
    const t = ctx.currentTime;
    [f.flyby, f.pass].forEach((s, i) => {
      const v = this.voices[i];
      const near = Math.min(1, s.near * 1.5);
      v.gain.gain.setTargetAtTime(Math.pow(near, 1.3) * 1.4, t, 0.05);
      // Доплер: приближается — выше, удаляется — ниже
      const doppler = 1 + 0.45 * Math.tanh(s.approach / 6);
      v.filter.frequency.setTargetAtTime((500 + 2600 * near) * doppler, t, 0.05);
      v.rumble.gain.setTargetAtTime(s.engine * (0.08 + 0.7 * near) * 0.6, t, 0.08);
      v.pan.pan.setTargetAtTime(s.pan * 0.9, t, 0.06);
    });
  }
}
