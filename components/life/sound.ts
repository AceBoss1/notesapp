// Notes Life sound. Everything is made in the browser with the Web Audio API, so there are no sound files to download (good on slow
// data). Two channels under one master volume: effects (taps, money, the phone, water, cooking…) and surroundings (birds by day,
// crickets at night, traffic on the street, lounge music at Candellux, the pool). Settings live on this device (localStorage).
// Browsers only allow sound after the player touches the page, so nothing plays until unlock() runs on the first tap.

export type SoundPrefs = { on: boolean; master: number; sfx: number; amb: number };
export const DEFAULT_SOUND: SoundPrefs = { on: true, master: 0.8, sfx: 0.9, amb: 0.5 };
const KEY = "notesLife:sound";

export function loadSoundPrefs(): SoundPrefs {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!j || typeof j !== "object") return { ...DEFAULT_SOUND };
    const v = (x: unknown, d: number) => (typeof x === "number" && isFinite(x) ? Math.max(0, Math.min(1, x)) : d);
    return { on: j.on !== false, master: v(j.master, DEFAULT_SOUND.master), sfx: v(j.sfx, DEFAULT_SOUND.sfx), amb: v(j.amb, DEFAULT_SOUND.amb) };
  } catch { return { ...DEFAULT_SOUND }; }
}
export function saveSoundPrefs(p: SoundPrefs) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode: this visit only */ } }

export type Sfx = "tap" | "coin" | "pay" | "ring" | "door" | "water" | "eat" | "sizzle" | "done" | "success" | "warn" | "sleep" | "whoosh" | "bell" | "horn" | "bonus" | "page" | "nepa_off" | "up_nepa" | "pull";
export type Ambience = "none" | "room" | "room-night" | "street" | "street-night" | "hotel" | "pool";

type Ctx = AudioContext;
export class Sound {
  private ctx: Ctx | null = null;
  private master!: GainNode; private sfxBus!: GainNode; private ambBus!: GainNode;
  private noise: AudioBuffer | null = null;
  private prefs: SoundPrefs;
  private amb: Ambience = "none"; private ambStop: (() => void)[] = []; private ambTimer = 0; private ambNext = 0;
  private ringTimer = 0;
  private music = 0;

  constructor(prefs: SoundPrefs) { this.prefs = prefs; }

  // On the first tap: make the audio context (or wake it up) and start the surroundings that were asked for before.
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const c = new AC();
      this.ctx = c;
      this.master = c.createGain(); this.master.connect(c.destination);
      this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
      this.ambBus = c.createGain(); this.ambBus.connect(this.master);
      const n = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = n;
      this.apply();
      const want = this.amb; this.amb = "none"; this.ambience(want);
      const g = this.gens.kind.split("|"); if (g.length === 2) this.generators(g[0] === "null" ? null : (g[0] as "small" | "big"), g[1] === "true");
    }
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
  }
  get ready() { return !!this.ctx && this.ctx.state === "running"; }

  setPrefs(p: SoundPrefs) { this.prefs = p; this.apply(); }
  private apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.prefs.on ? this.prefs.master : 0, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.prefs.sfx, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.prefs.amb, t, 0.2);
  }
  pause() { void this.ctx?.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.prefs.on) void this.ctx.resume().catch(() => {}); }

  // ---- building blocks ----
  private tone(freq: number, at: number, dur: number, opts: { type?: OscillatorType; gain?: number; to?: number; bus?: GainNode; attack?: number } = {}) {
    const c = this.ctx!; const o = c.createOscillator(), g = c.createGain();
    o.type = opts.type ?? "sine"; o.frequency.setValueAtTime(freq, at);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, at + dur);
    const peak = opts.gain ?? 0.2, a = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + a); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(opts.bus ?? this.sfxBus); o.start(at); o.stop(at + dur + 0.02);
  }
  private hiss(at: number, dur: number, opts: { type?: BiquadFilterType; freq?: number; to?: number; q?: number; gain?: number; bus?: GainNode; attack?: number; loop?: boolean } = {}) {
    const c = this.ctx!; const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.loop = true;
    f.type = opts.type ?? "bandpass"; f.frequency.setValueAtTime(opts.freq ?? 1000, at); f.Q.value = opts.q ?? 1;
    if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, at + dur);
    const peak = opts.gain ?? 0.2, a = opts.attack ?? 0.01;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + a);
    if (!opts.loop) g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(f); f.connect(g); g.connect(opts.bus ?? this.sfxBus);
    s.start(at, Math.random()); if (!opts.loop) s.stop(at + dur + 0.05);
    return { stop: () => { const t = c.currentTime; g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0.0001, t, 0.3); s.stop(t + 1.5); } };
  }

  // ---- effects ----
  play(name: Sfx) {
    if (!this.ctx || !this.prefs.on || this.ctx.state !== "running") return;
    const t = this.ctx.currentTime + 0.01;
    switch (name) {
      case "tap": this.tone(880, t, 0.05, { gain: 0.06, type: "triangle" }); break;
      case "page": this.hiss(t, 0.18, { freq: 3000, q: 0.5, gain: 0.08, to: 1500 }); break;
      case "coin": this.tone(988, t, 0.09, { gain: 0.15, type: "square" }); this.tone(1319, t + 0.08, 0.35, { gain: 0.13, type: "square" }); break;
      case "pay": this.hiss(t, 0.06, { freq: 3500, q: 2, gain: 0.15 }); this.tone(1568, t + 0.05, 0.12, { gain: 0.12, type: "triangle" }); this.tone(2093, t + 0.13, 0.4, { gain: 0.12, type: "triangle" }); break;
      case "ring": for (let i = 0; i < 16; i++) this.tone(i % 2 ? 1046 : 1318, t + i * 0.055, 0.05, { gain: 0.12, type: "triangle" }); for (let i = 0; i < 16; i++) this.tone(i % 2 ? 1046 : 1318, t + 1.1 + i * 0.055, 0.05, { gain: 0.12, type: "triangle" }); break;
      case "door": this.tone(140, t, 0.18, { gain: 0.3, to: 70 }); this.hiss(t, 0.25, { type: "lowpass", freq: 600, gain: 0.12 }); this.tone(120, t + 0.22, 0.12, { gain: 0.2, to: 60 }); break;
      case "water": this.hiss(t, 2.2, { freq: 1400, q: 0.6, gain: 0.12, attack: 0.25 }); this.hiss(t, 2.2, { type: "highpass", freq: 5000, gain: 0.04, attack: 0.3 }); break;
      case "eat": for (let i = 0; i < 5; i++) this.hiss(t + i * 0.16 + Math.random() * 0.04, 0.06, { type: "highpass", freq: 2500, gain: 0.12 }); break;
      case "sizzle": { const h = this.hiss(t, 3, { type: "highpass", freq: 4500, gain: 0.07, attack: 0.3, loop: true }); setTimeout(() => h.stop(), 2600); break; }
      case "done": this.tone(784, t, 0.14, { gain: 0.12 }); this.tone(1047, t + 0.12, 0.35, { gain: 0.12 }); break;
      case "success": [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.09, 0.3, { gain: 0.12, type: "triangle" })); break;
      case "bonus": [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, t + i * 0.08, 0.35, { gain: 0.12, type: "square" })); this.tone(2093, t + 0.4, 0.6, { gain: 0.08 }); break;
      case "warn": this.tone(392, t, 0.15, { gain: 0.15, type: "triangle" }); this.tone(294, t + 0.15, 0.25, { gain: 0.15, type: "triangle" }); break;
      case "sleep": [659, 523, 392].forEach((f, i) => this.tone(f, t + i * 0.3, 0.6, { gain: 0.08, attack: 0.08 })); break;
      case "whoosh": this.hiss(t, 1.1, { freq: 300, to: 1800, q: 1.2, gain: 0.15, attack: 0.3 }); break;
      case "bell": this.tone(2637, t, 0.5, { gain: 0.1 }); this.tone(2637, t + 0.18, 0.7, { gain: 0.1 }); break;
      case "horn": this.horn(t, 0.14); break;
      case "nepa_off": this.tone(420, t, 0.9, { gain: 0.16, type: "sawtooth", to: 45 }); this.hiss(t, 0.12, { type: "highpass", freq: 3000, gain: 0.12 }); break; // everything winds down
      case "pull": for (let i = 0; i < 3; i++) this.hiss(t + i * 0.32, 0.22, { freq: 600, to: 1800, q: 2, gain: 0.12 }); break; // pulling the generator cord
      case "up_nepa": { // nwiiiiii: every appliance at once, then children shouting UP NEPA!
        this.tone(180, t, 1.4, { gain: 0.1, type: "sawtooth", to: 1400, attack: 0.3 }); this.tone(240, t, 1.4, { gain: 0.06, type: "square", to: 1700, attack: 0.3 });
        for (let i = 0; i < 9; i++) this.hiss(t + 1.2 + i * 0.09 + Math.random() * 0.05, 0.25, { freq: 900 + Math.random() * 900, q: 3, gain: 0.08 });
        break;
      }
    }
  }
  private horn(t: number, gain: number, bus?: GainNode) {
    const c = this.ctx!; const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1400; f.connect(bus ?? this.sfxBus);
    for (const [hz, start, d] of [[415, 0, 0.18], [440, 0.24, 0.3]] as const) {
      const o = c.createOscillator(), g = c.createGain(); o.type = "square"; o.frequency.value = hz;
      g.gain.setValueAtTime(0.0001, t + start); g.gain.exponentialRampToValueAtTime(gain, t + start + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + start + d);
      o.connect(g); g.connect(f); o.start(t + start); o.stop(t + start + d + 0.02);
    }
  }

  // Generators: yours by the door (small or big), and the neighbours' in the distance during every blackout.
  private gens: { mine: (() => void) | null; near: (() => void) | null; kind: string; started: boolean } = { mine: null, near: null, kind: "", started: false };
  generators(mine: "small" | "big" | null, neighbours: boolean) {
    const key = `${mine}|${neighbours}`;
    if (!this.ctx) { this.gens.kind = key; return; } // played on unlock()
    if (key === this.gens.kind && this.gens.started) return;
    this.gens.kind = key; this.gens.started = true;
    this.gens.mine?.(); this.gens.near?.(); this.gens.mine = this.gens.near = null;
    const hum = (hz: number, gain: number, cut: number) => {
      const c = this.ctx!, t = c.currentTime, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      o.type = "sawtooth"; o.frequency.value = hz; f.type = "lowpass"; f.frequency.value = cut; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.8);
      lfo.frequency.value = 7 + Math.random() * 3; lg.gain.value = gain * 0.35; lfo.connect(lg); lg.connect(g.gain);
      o.connect(f); f.connect(g); g.connect(this.ambBus); o.start(); lfo.start();
      const n = this.hiss(t, 1, { type: "lowpass", freq: cut * 1.6, gain: gain * 0.6, bus: this.ambBus, attack: 0.8, loop: true });
      return () => { const t2 = c.currentTime; g.gain.cancelScheduledValues(t2); g.gain.setTargetAtTime(0.0001, t2, 0.25); o.stop(t2 + 1.2); lfo.stop(t2 + 1.2); n.stop(); };
    };
    if (mine) this.gens.mine = hum(mine === "big" ? 38 : 52, mine === "big" ? 0.16 : 0.12, mine === "big" ? 260 : 340);
    if (neighbours) this.gens.near = hum(47, 0.04, 220);
  }

  // The bedside phone keeps ringing while a deal call is waiting.
  ringing(on: boolean) {
    window.clearInterval(this.ringTimer); this.ringTimer = 0;
    if (!on) return;
    this.play("ring");
    this.ringTimer = window.setInterval(() => this.play("ring"), 3500);
  }

  // ---- surroundings ----
  ambience(next: Ambience) {
    if (next === this.amb) return;
    this.amb = next;
    if (!this.ctx) return; // starts on unlock()
    this.ambStop.forEach((f) => f()); this.ambStop = [];
    window.clearInterval(this.ambTimer); this.ambTimer = 0;
    window.clearInterval(this.music); this.music = 0;
    if (next === "none") return;
    const c = this.ctx, bus = this.ambBus, now = c.currentTime;
    if (next === "street" || next === "street-night") { // the road: a low rumble of traffic
      this.ambStop.push(this.hiss(now, 1, { type: "lowpass", freq: 380, gain: next === "street" ? 0.22 : 0.1, bus, attack: 1, loop: true }).stop);
    }
    if (next === "room") this.ambStop.push(this.hiss(now, 1, { type: "lowpass", freq: 250, gain: 0.05, bus, attack: 1, loop: true }).stop); // the fan
    if (next === "pool") this.ambStop.push(this.hiss(now, 1, { freq: 700, q: 0.4, gain: 0.12, bus, attack: 1, loop: true }).stop); // water
    if (next === "hotel") this.lounge();
    this.ambNext = 0;
    this.ambTimer = window.setInterval(() => {
      if (!this.ctx || this.ctx.state !== "running") return;
      const t = this.ctx.currentTime;
      if (t < this.ambNext) return;
      const r = Math.random();
      if (next === "room" || next === "pool") { // birds outside the window
        const base = 2400 + Math.random() * 1400, n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) this.tone(base, t + i * 0.12, 0.08, { gain: 0.05, to: base * 1.35, bus });
        this.ambNext = t + 1.5 + Math.random() * 4;
      } else if (next === "room-night" || next === "street-night") { // crickets
        for (let i = 0; i < 3; i++) this.tone(4400, t + i * 0.05, 0.025, { gain: 0.035, bus });
        this.ambNext = t + 0.5 + Math.random() * 0.7;
        if (next === "street-night" && r < 0.03) this.horn(t + 0.2, 0.04, bus);
      } else if (next === "street") { // keke and car horns now and then
        if (r < 0.5) this.horn(t, 0.05 + Math.random() * 0.04, bus);
        else this.hiss(t, 2.5, { type: "lowpass", freq: 200, to: 900, gain: 0.12, bus, attack: 1 }); // a car going past
        this.ambNext = t + 4 + Math.random() * 8;
      }
    }, 200);
  }
  // Candellux: soft lounge chords (Cmaj7, Am7, Fmaj7, G6), four seconds each, round and round.
  private lounge() {
    const chords = [[261.6, 329.6, 392, 493.9], [220, 261.6, 329.6, 392], [174.6, 220, 261.6, 329.6], [196, 246.9, 293.7, 329.6]];
    let i = 0;
    const playChord = () => {
      if (!this.ctx || this.ctx.state !== "running") return;
      const t = this.ctx.currentTime;
      for (const f of chords[i % chords.length]) this.tone(f, t, 3.9, { gain: 0.035, type: "triangle", attack: 0.6, bus: this.ambBus });
      this.tone(chords[i % chords.length][0] / 2, t, 3.9, { gain: 0.05, attack: 0.3, bus: this.ambBus });
      i++;
    };
    playChord();
    this.music = window.setInterval(playChord, 4000);
  }

  dispose() {
    this.ringing(false);
    this.gens.mine?.(); this.gens.near?.();
    this.ambience("none");
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
