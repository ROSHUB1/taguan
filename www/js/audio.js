// Sound: all effects and the music are synthesized with WebAudio, so there are no audio files to ship.
// Browsers (and Android WebView) only start audio after a touch, so Sfx.unlock() is called on the first tap.
// Every call is wrapped in try/catch: a sound problem must never break the game.
const Sfx = {
  ctx: null,
  master: null,
  fxGain: null,
  musicGain: null,
  noiseBuf: null,
  musicOn: true,
  sfxOn: true,
  vibrateOn: true,
  tension: 0,            // 0..1, makes the game music faster and louder
  _timer: null,
  _step: 0,
  _nextT: 0,
  _mode: null,

  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(this.ctx.destination);
        this.fxGain = this.ctx.createGain();
        this.fxGain.gain.value = 0.9;
        this.fxGain.connect(this.master);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.55;
        this.musicGain.connect(this.master);
        const n = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, n, n);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (this._mode && this.musicOn) this._startTimer();
    } catch (e) { /* no audio available */ }
  },

  apply(settings) {
    this.musicOn = !!settings.music;
    this.sfxOn = !!settings.sfx;
    this.vibrateOn = !!settings.vibrate;
    if (!this.musicOn) this._stopTimer();
    else if (this._mode && this.ctx) this._startTimer();
  },

  vibrate(ms) {
    try { if (this.vibrateOn && navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ }
  },

  tone(freq, dur, type, vol, opts) {
    try {
      opts = opts || {};
      if (!this.ctx || (!opts.music && !this.sfxOn)) return;
      const t0 = this.ctx.currentTime + (opts.delay || 0);
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(opts.music ? this.musicGain : this.fxGain);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    } catch (e) { /* ignore */ }
  },

  noise(dur, vol, freq, opts) {
    try {
      opts = opts || {};
      if (!this.ctx || !this.sfxOn) return;
      const t0 = this.ctx.currentTime + (opts.delay || 0);
      const s = this.ctx.createBufferSource();
      s.buffer = this.noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq || 1000;
      f.Q.value = 0.8;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      s.connect(f); f.connect(g); g.connect(this.fxGain);
      s.start(t0);
      s.stop(t0 + dur + 0.05);
    } catch (e) { /* ignore */ }
  },

  play(name) {
    try {
      switch (name) {
        case 'click': this.tone(880, 0.05, 'square', 0.07); break;
        case 'back': this.tone(520, 0.07, 'square', 0.07); break;
        case 'step': this.noise(0.04, 0.05, 700); break;
        case 'hide': this.noise(0.28, 0.14, 1900); this.tone(300, 0.18, 'sine', 0.1, { slide: 180 }); break;
        case 'unhide': this.noise(0.18, 0.1, 1400); break;
        case 'heard': this.tone(330, 0.12, 'triangle', 0.1); break;
        case 'spotted': this.tone(660, 0.12, 'square', 0.14); this.tone(990, 0.2, 'square', 0.14, { delay: 0.1 }); break;
        case 'hurt': this.tone(240, 0.4, 'sawtooth', 0.2, { slide: 70 }); this.noise(0.3, 0.14, 500); break;
        case 'tick': this.tone(1000, 0.05, 'square', 0.07); break;
        case 'go': [523, 659, 784].forEach((f, i) => this.tone(f, 0.14, 'square', 0.1, { delay: i * 0.07 })); break;
        case 'caught': this.tone(520, 0.1, 'square', 0.1); this.tone(390, 0.18, 'square', 0.1, { delay: 0.09 }); break;
        case 'win': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.16, { delay: i * 0.13 })); break;
        case 'lose': this.tone(392, 0.4, 'sawtooth', 0.14, { slide: 196 }); this.tone(262, 0.6, 'sawtooth', 0.14, { slide: 131, delay: 0.35 }); break;
        case 'save': [659, 784, 988, 1319].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.15, { delay: i * 0.08 })); break;
        case 'star': this.tone(1175, 0.2, 'triangle', 0.14); this.tone(1568, 0.3, 'triangle', 0.12, { delay: 0.08 }); break;
        case 'unlock': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.2, 'sine', 0.13, { delay: i * 0.09 })); break;
        case 'deny': this.tone(180, 0.15, 'square', 0.1); break;
        default: break;
      }
    } catch (e) { /* ignore */ }
  },

  // ---- music
  startMusic(mode) {
    this._mode = mode;
    this._step = 0;
    if (this.ctx && this.musicOn) this._startTimer();
  },
  stopMusic() { this._mode = null; this._stopTimer(); },
  _startTimer() {
    if (this._timer || !this.ctx) return;
    this._nextT = this.ctx.currentTime + 0.1;
    this._timer = setInterval(() => this._schedule(), 110);
  },
  _stopTimer() { if (this._timer) { clearInterval(this._timer); this._timer = null; } },
  _schedule() {
    try {
      if (!this.ctx || !this.musicOn || !this._mode) return;
      const step = this._mode === 'game' ? (0.34 - 0.12 * this.tension) : 0.36;
      while (this._nextT < this.ctx.currentTime + 0.45) {
        this._note(this._nextT, step);
        this._nextT += step;
        this._step++;
      }
    } catch (e) { /* ignore */ }
  },
  _note(t, step) {
    const A = [220.0, 261.63, 293.66, 329.63, 392.0];       // A minor pentatonic
    const i = this._step;
    const delay = Math.max(0, t - this.ctx.currentTime);
    if (this._mode === 'menu') {
      const pat = [0, 2, 4, 2, 3, 1, 2, 0];
      const f = A[pat[i % pat.length]] * (i % 16 >= 8 ? 2 : 1);
      this.tone(f, step * 1.8, 'triangle', 0.07, { music: true, delay });
      if (i % 8 === 0) this.tone(110, step * 6, 'sine', 0.1, { music: true, delay });
    } else {
      const k = this.tension;
      if (i % 2 === 0) this.tone(i % 8 === 0 ? 55 : 55 * 1.06, step * 1.4, 'sine', 0.1 + 0.07 * k, { music: true, delay });
      if (i % 4 === 3) this.tone(A[(i * 7) % 5] * 2, step * 2, 'triangle', 0.035, { music: true, delay });
      if (k > 0.5 && i % 2 === 1) this.tone(440, 0.07, 'sawtooth', 0.03 * k, { music: true, delay });
    }
  }
};
