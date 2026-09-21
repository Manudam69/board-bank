import { Injectable, signal } from '@angular/core';

type SoundName =
  | 'transfer'
  | 'buy'
  | 'build'
  | 'cashIn'
  | 'cashOut'
  | 'error'
  | 'undo'
  | 'salary'
  | 'notify'
  | 'click'
  | 'success'
  | 'start';

@Injectable({
  providedIn: 'root',
})
export class SoundService {
  private readonly STORAGE_KEY = 'boardbank-sounds';
  private ctx: AudioContext | null = null;
  private readonly _enabled = signal(this.readEnabled());
  readonly enabled = this._enabled.asReadonly();

  toggle(): void {
    this._enabled.update((current) => {
      const next = !current;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  play(name: SoundName): void {
    if (!this._enabled()) return;
    if (!this.ctx) {
      this.ctx = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        // Browsers may block resume; ignore silently.
      });
    }

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    switch (name) {
      case 'transfer':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, t);
        osc.frequency.exponentialRampToValueAtTime(659.25, t + 0.08);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.start(t);
        osc.stop(t + 0.12);
        break;
      case 'buy':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, t);
        osc.frequency.setValueAtTime(659.25, t + 0.08);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.start(t);
        osc.stop(t + 0.22);
        break;
      case 'build':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, t);
        gain.gain.setValueAtTime(0.06, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
        break;
      case 'cashIn':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.exponentialRampToValueAtTime(880, t + 0.12);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.start(t);
        osc.stop(t + 0.18);
        break;
      case 'salary':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, t);
        osc.frequency.setValueAtTime(659.25, t + 0.06);
        osc.frequency.setValueAtTime(783.99, t + 0.12);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc.start(t);
        osc.stop(t + 0.28);
        break;
      case 'cashOut':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.exponentialRampToValueAtTime(220, t + 0.12);
        gain.gain.setValueAtTime(0.06, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.start(t);
        osc.stop(t + 0.18);
        break;
      case 'error':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.start(t);
        osc.stop(t + 0.15);
        break;
      case 'undo':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, t);
        osc.frequency.exponentialRampToValueAtTime(440, t + 0.14);
        gain.gain.setValueAtTime(0.07, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.start(t);
        osc.stop(t + 0.18);
        break;
      case 'notify':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, t);
        osc.frequency.setValueAtTime(880, t + 0.1);
        gain.gain.setValueAtTime(0.07, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
        osc.start(t);
        osc.stop(t + 0.24);
        break;
      case 'click':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.exponentialRampToValueAtTime(600, t + 0.04);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        osc.start(t);
        osc.stop(t + 0.06);
        break;
      case 'success':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, t);
        osc.frequency.setValueAtTime(659.25, t + 0.07);
        osc.frequency.setValueAtTime(783.99, t + 0.14);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.setValueAtTime(0.08, t + 0.14);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc.start(t);
        osc.stop(t + 0.28);
        break;
      case 'start':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.setValueAtTime(554.37, t + 0.1);
        osc.frequency.setValueAtTime(659.25, t + 0.2);
        osc.frequency.setValueAtTime(783.99, t + 0.3);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.setValueAtTime(0.1, t + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.start(t);
        osc.stop(t + 0.45);
        break;
    }
  }

  private readEnabled(): boolean {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? (JSON.parse(raw) as boolean) : true;
    } catch {
      return true;
    }
  }
}
