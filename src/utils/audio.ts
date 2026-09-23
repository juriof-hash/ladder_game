/**
 * Dynamic Web Audio API Synthesizer for Ladder Game.
 * Features arcade-grade punchy, responsive sound effects:
 * - Dynamics compressor to prevent distortion and maximize punch
 * - Marimba/xylophone melodic steps that scale dynamically as characters descend
 * - Dynamic springy comic "boing" / slide effects on bridge turns (direction-aware)
 * - Powerful multi-layered finish fanfare with kick impact and celebratory chimes
 * - Grand victory anthem when all players reach their destination
 * - Crisp tactile clicks, pops, card-shuffle, and rung modification effects
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private isMuted: boolean = false;
  private stepCounter: number = 0;

  constructor() {
    // Lazy initialized on first user interaction
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();

      // Master compressor to ensure crystal-clear mix even when all 12 players move simultaneously
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(10, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.12, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  /**
   * General crisp UI click sound
   */
  public playClick() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;

      // Clean pop
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.04);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch {
      // Audio fallback
    }
  }

  /**
   * Energetic Launch Sound when a player or all players start
   */
  public playLaunch(isAll = false) {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;

      // Rising whoosh sweep
      const sweep = this.ctx.createOscillator();
      const sweepGain = this.ctx.createGain();
      sweep.type = 'triangle';
      sweep.frequency.setValueAtTime(240, now);
      sweep.frequency.exponentialRampToValueAtTime(isAll ? 1200 : 880, now + 0.16);

      sweepGain.gain.setValueAtTime(0.01, now);
      sweepGain.gain.linearRampToValueAtTime(0.22, now + 0.08);
      sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      sweep.connect(sweepGain);
      sweepGain.connect(this.masterGain);
      sweep.start(now);
      sweep.stop(now + 0.22);

      // Playful bright launch chime chord
      const chords = isAll ? [523.25, 659.25, 783.99, 1046.5] : [440, 659.25, 880];
      chords.forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + 0.04 + idx * 0.035;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.18);
      });
    } catch {
      // Audio fallback
    }
  }

  /**
   * Marimba/Kalimba melodic bouncy step when moving downwards.
   * Steps cycle through a joyful pentatonic scale (C, D, E, G, A) with warm mallet overtone.
   */
  public playStep(pitchOffset = 1.0) {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;

      this.stepCounter++;
      // Pentatonic scale frequencies: C4, D4, E4, G4, A4, C5, D5, E5, G5
      const pentatonic = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];
      const scaleIndex = this.stepCounter % pentatonic.length;
      const baseFreq = pentatonic[scaleIndex] * pitchOffset;

      // 1. Primary body tone (warm triangle/sine blend)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(baseFreq, now);

      gain1.gain.setValueAtTime(0.22, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc1.connect(gain1);
      gain1.connect(this.masterGain);
      osc1.start(now);
      osc1.stop(now + 0.09);

      // 2. High harmonic mallet "tok" click
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(baseFreq * 2.75, now);
      gain2.gain.setValueAtTime(0.12, now);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

      osc2.connect(gain2);
      gain2.connect(this.masterGain);
      osc2.start(now);
      osc2.stop(now + 0.035);
    } catch {
      // Audio fallback
    }
  }

  /**
   * Dynamic, comic springy "BOING" / slide whistle when turning onto a horizontal bridge!
   * Left-to-right: energetic rising slide with vibrato.
   * Right-to-left: funny energetic descending-then-bouncing spring.
   */
  public playBridgeTurn(direction: 'left' | 'right' = 'right') {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, now);
      filter.Q.setValueAtTime(4, now);

      osc.type = 'sawtooth';

      if (direction === 'right') {
        // Rising punchy spring whip: 320Hz -> 880Hz
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.11);
      } else {
        // Descending bouncy whip: 820Hz -> 380Hz
        osc.frequency.setValueAtTime(820, now);
        osc.frequency.exponentialRampToValueAtTime(380, now + 0.11);
      }

      // Add quick wobble for comic cartoon effect
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.14);

      // Layer with a bright secondary chime ping
      const ping = this.ctx.createOscillator();
      const pingGain = this.ctx.createGain();
      ping.type = 'sine';
      ping.frequency.setValueAtTime(direction === 'right' ? 1046.5 : 987.77, now + 0.03);
      pingGain.gain.setValueAtTime(0.12, now + 0.03);
      pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      ping.connect(pingGain);
      pingGain.connect(this.masterGain);
      ping.start(now + 0.03);
      ping.stop(now + 0.12);
    } catch {
      // Audio fallback
    }
  }

  /**
   * Multi-layered Victory Fanfare on reaching a destination!
   * 1. Low impact kick for satisfying punch
   * 2. Triumphant brass/synth chord blast (C major arpeggio)
   * 3. Shimmering cascade sparkle chimes
   */
  public playFinish() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;

      // 1. Kick/Sub thump
      const kick = this.ctx.createOscillator();
      const kickGain = this.ctx.createGain();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(140, now);
      kick.frequency.exponentialRampToValueAtTime(38, now + 0.12);
      kickGain.gain.setValueAtTime(0.35, now);
      kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      kick.connect(kickGain);
      kickGain.connect(this.masterGain);
      kick.start(now);
      kick.stop(now + 0.14);

      // 2. Triumphant major chord (C5 - E5 - G5 - C6)
      const chordNotes = [523.25, 659.25, 783.99, 1046.5];
      chordNotes.forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + idx * 0.045;

        osc.type = idx === 3 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.24, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.45);
      });

      // 3. Shimmering high sparkle chimes
      const sparkles = [1318.51, 1567.98, 2093.0];
      sparkles.forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + 0.2 + idx * 0.05;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.14, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.28);
      });
    } catch {
      // Audio fallback
    }
  }

  /**
   * Grand Finale Victory Anthem when ALL players have arrived!
   * Plays classic celebratory arcade melody: Ta-da-da-daaa, Ta-daaa!
   */
  public playAllFinished() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;

      // Note sequence [freq, startOffset, duration, gain]
      // C5, C5, C5, F5, A5, C6 (Grand celebratory anthem)
      const melody: [number, number, number, number][] = [
        [523.25, 0.00, 0.09, 0.22], // C5
        [523.25, 0.11, 0.09, 0.22], // C5
        [523.25, 0.22, 0.09, 0.22], // C5
        [698.46, 0.33, 0.25, 0.28], // F5
        [880.00, 0.60, 0.22, 0.28], // A5
        [1046.5, 0.84, 0.70, 0.35], // C6 (Long triumphant chord)
        [1318.51, 0.86, 0.68, 0.22], // E6 harmonic layer
        [1567.98, 0.88, 0.65, 0.20], // G6 harmonic layer
        [2093.00, 0.90, 0.60, 0.15], // C7 sparkle
      ];

      melody.forEach(([freq, offset, dur, volume]) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + offset;

        osc.type = freq > 1000 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(volume, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + dur);
      });
    } catch {
      // Audio fallback
    }
  }

  /**
   * Sound when a bridge rung is added
   */
  public playRungAdd() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;

      // Crisp mechanical snap
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.04);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // Audio fallback
    }
  }

  /**
   * Sound when a bridge rung is removed
   */
  public playRungRemove() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;

      // Soft suction pop
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.06);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch {
      // Audio fallback
    }
  }

  /**
   * Dynamic playing-card / dice ruffle shuffle sound
   */
  public playShuffle() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;

      for (let i = 0; i < 7; i++) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const noteTime = now + i * 0.025;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(450 + Math.random() * 500, noteTime);

        gain.gain.setValueAtTime(0.12, noteTime);
        gain.gain.linearRampToValueAtTime(0.001, noteTime + 0.024);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(noteTime);
        osc.stop(noteTime + 0.025);
      }
    } catch {
      // Audio fallback
    }
  }
}

export const sound = new SoundEngine();
