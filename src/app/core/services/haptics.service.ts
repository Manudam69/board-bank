import { Service, inject } from '@angular/core';
import { SoundService } from './sound.service';

export type HapticPattern = 'tap' | 'selection' | 'success' | 'error' | 'heavy';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 8,
  selection: 5,
  success: [12, 50, 24],
  error: [30, 60, 30],
  heavy: 20,
};

/** Short vibrations for touch feedback. Silent where the Vibration API is missing (iOS Safari). */
@Service()
export class HapticsService {
  private readonly sound = inject(SoundService);

  play(pattern: HapticPattern): void {
    // The sound toggle doubles as the user's "feedback" preference.
    if (!this.sound.enabled()) return;
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    navigator.vibrate(PATTERNS[pattern]);
  }
}
