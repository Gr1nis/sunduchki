// Organic Acoustic Sound Synthesizer (Natural card rustle, wooden taps, warm chimes)
class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Realistic card sliding / rustle on felt table using filtered noise
  playCardDeal() {
    if (this.muted) return;
    this.init();
    const duration = 0.12;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + duration);
    filter.Q.setValueAtTime(1.5, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    whiteNoise.start();
  }

  // Gentle acoustic marimba / chime note
  playChimeTone(freq, time, duration = 0.5, volume = 0.15) {
    // Fundamental
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, time);

    // Warm overtone
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2.02, time);

    gain1.gain.setValueAtTime(volume, time);
    gain1.gain.exponentialRampToValueAtTime(0.001, time + duration);

    gain2.gain.setValueAtTime(volume * 0.28, time);
    gain2.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.5);

    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(this.ctx.destination);
    gain2.connect(this.ctx.destination);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + duration);
    osc2.stop(time + duration);
  }

  // Soft wooden / felt knuckle tap on table (no harsh buzzers!)
  playMiss() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    [0, 0.09].forEach((offset, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(idx === 0 ? 110 : 85, now + offset);
      osc.frequency.exponentialRampToValueAtTime(45, now + offset + 0.08);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350, now + offset);

      gain.gain.setValueAtTime(0.22, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + offset);
      osc.stop(now + offset + 0.08);
    });
  }

  // Warm acoustic chime cascade for correct answer
  playSuccess() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    // Pleasant major third / fifth chime (E5 -> A5)
    this.playChimeTone(659.25, now, 0.45, 0.12);
    this.playChimeTone(880.00, now + 0.09, 0.6, 0.14);
  }

  // Regal music box / coin shimmer for Chest collection
  playChest() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    chord.forEach((freq, idx) => {
      this.playChimeTone(freq, now + idx * 0.08, 0.7, 0.15);
    });
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
}

export const sounds = new SoundManager();
