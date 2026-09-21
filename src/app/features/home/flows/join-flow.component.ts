import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PlayerIdentityService } from '../../../core/services/player-identity.service';
import { RoomService } from '../../../core/services/room.service';
import { SoundService } from '../../../core/services/sound.service';
import { mapFirebaseError } from '../../../core/utils/firebase-errors';
import { ButtonComponent } from '../../../shared/components/ui/button.component';
import { PlayerNameStepComponent } from '../../../shared/components/domain/player-name-step.component';

type JoinStatus = 'idle' | 'searching' | 'found' | 'error';

@Component({
  selector: 'app-join-flow',
  imports: [FormsModule, ButtonComponent, PlayerNameStepComponent],
  template: `
    @if (nameSet()) {
      <div class="flex flex-col gap-5">
        <div
          class="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-elevated/50 px-4 py-3"
        >
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-bold text-white"
              aria-hidden="true"
            >
              {{ initials() }}
            </div>
            <p class="truncate font-medium text-text">{{ identity.name() }}</p>
          </div>
          <button
            type="button"
            class="shrink-0 text-xs font-medium text-text-secondary transition hover:text-text"
            (click)="resetName()"
          >
            Cambiar
          </button>
        </div>

        <div class="w-full">
          <label for="room-code" class="sr-only">Código de partida</label>
          <input
            id="room-code"
            type="text"
            inputmode="text"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            maxlength="5"
            placeholder="_____"
            class="w-full bg-transparent py-3 text-center text-3xl font-bold uppercase tracking-[0.5em] text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
            [class.border-b-2]="status() !== 'error'"
            [class.border-border]="status() !== 'error'"
            [class.border-b-negative]="status() === 'error'"
            [class.animate-shake]="status() === 'error'"
            [disabled]="status() === 'searching' || status() === 'found'"
            [ngModel]="code()"
            (ngModelChange)="onCodeChange($event)"
            (keydown.enter)="join()"
          />
          <p class="mt-1 text-center text-xs text-text-muted">Código de 5 caracteres</p>
        </div>

        @switch (status()) {
          @case ('idle') {
            <app-button [fullWidth]="true" size="lg" [disabled]="!canJoin()" (clickAction)="join()">
              Unirse
            </app-button>
          }
          @case ('searching') {
            <app-button [fullWidth]="true" size="lg" [loading]="true" [disabled]="true">
              Buscando...
            </app-button>
          }
          @case ('found') {
            <div class="flex animate-scale-in items-center justify-center gap-2 text-positive">
              <svg
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span class="font-medium">¡Partida encontrada!</span>
            </div>
          }
          @case ('error') {
            <p class="flex items-center justify-center gap-1.5 text-sm text-negative" role="alert">
              <svg
                class="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 9v2m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
                />
              </svg>
              {{ errorMessage() }}
            </p>
          }
        }
      </div>
    } @else {
      <app-player-name-step
        [(name)]="name"
        continueLabel="Continuar →"
        (nextAction)="identity.setName(name())"
      />
    }
  `,
})
export class JoinFlowComponent {
  protected readonly identity = inject(PlayerIdentityService);
  private readonly router = inject(Router);
  private readonly roomService = inject(RoomService);
  private readonly soundService = inject(SoundService);

  readonly name = signal(this.identity.name());
  readonly code = signal('');
  readonly status = signal<JoinStatus>('idle');
  readonly errorMessage = signal('');

  readonly nameSet = computed(() => this.identity.name().trim().length > 0);
  readonly initials = computed(() => this.identity.name().trim().slice(0, 2).toUpperCase() || '?');
  readonly canJoin = computed(
    () => this.code().length === 5 && this.identity.name().trim().length > 0,
  );

  constructor() {
    effect(() => {
      const stored = this.identity.name();
      if (!this.name().trim() && stored.trim()) {
        this.name.set(stored);
      }
    });
  }

  protected onCodeChange(value: string): void {
    const sanitized = value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 5);
    this.code.set(sanitized);
    if (this.status() === 'error') {
      this.status.set('idle');
      this.errorMessage.set('');
    }
  }

  protected resetName(): void {
    const current = this.identity.name();
    this.identity.clear();
    this.name.set(current);
  }

  protected async join(): Promise<void> {
    if (!this.canJoin()) return;

    this.status.set('searching');
    this.errorMessage.set('');
    try {
      const room = await this.roomService.joinRoom(this.code(), this.identity.name());
      this.soundService.play('success');
      this.status.set('found');
      setTimeout(() => this.router.navigate(['/lobby', room.id]), 700);
    } catch (e) {
      this.status.set('error');
      this.errorMessage.set(mapFirebaseError(e));
      this.soundService.play('error');
    }
  }
}
