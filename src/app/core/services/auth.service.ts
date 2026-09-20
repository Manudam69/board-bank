import { Injectable, inject, signal } from '@angular/core';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { FirebaseInitService } from './firebase-init.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly firebase = inject(FirebaseInitService);
  private readonly auth = this.firebase.auth;

  readonly userId = signal<string | null>(null);
  readonly ready = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    onAuthStateChanged(this.auth, (user) => {
      this.userId.set(user?.uid ?? null);
    });
    this.ensureSignedIn();
  }

  private async ensureSignedIn(): Promise<void> {
    if (this.auth.currentUser) {
      this.userId.set(this.auth.currentUser.uid);
      this.ready.set(true);
      return;
    }

    try {
      await signInAnonymously(this.auth);
      this.error.set(null);
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (code === 'auth/configuration-not-found' || code === 'auth/operation-not-allowed') {
        this.error.set('Autenticación anónima no habilitada en Firebase Console.');
      } else {
        this.error.set('No se pudo conectar con Firebase Authentication.');
      }
      console.error('Anonymous sign-in failed', e);
    } finally {
      this.ready.set(true);
    }
  }
}
