import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlayerIdentityService } from '../../../core/services/player-identity.service';
import { SoundService } from '../../../core/services/sound.service';
import { ButtonComponent } from '../../../shared/components/ui/button.component';
import { LogoComponent } from '../../../shared/components/ui/logo.component';

@Component({
  selector: 'app-hero',
  imports: [FormsModule, ButtonComponent, LogoComponent],
  template: `
    <section
      class="relative flex min-h-svh flex-col items-center justify-center px-4 py-16 text-center"
    >
      <div class="animate-fade-in opacity-0">
        <app-logo size="xl" class="mx-auto text-accent" />
      </div>

      <h1
        class="animate-slide-up animation-delay-100 opacity-0 mt-6 text-5xl font-extrabold tracking-tight text-text sm:text-6xl"
      >
        BOARD
        <span class="block text-accent">BANK</span>
      </h1>

      <p
        class="animate-slide-up animation-delay-200 opacity-0 mt-5 max-w-md text-xl font-medium text-text"
      >
        Tu Monopoly, sin billetes.
      </p>
      <p
        class="animate-slide-up animation-delay-300 opacity-0 mt-2 max-w-sm text-base text-text-secondary"
      >
        Lleva el dinero de la partida directamente desde tu teléfono.
      </p>

      <div class="animate-slide-up animation-delay-400 opacity-0 mt-8 w-full max-w-xs">
        @if (greeting()) {
          <div
            class="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left"
          >
            <div class="flex items-center gap-3">
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white"
                aria-hidden="true"
              >
                {{ initials() }}
              </div>
              <div class="min-w-0">
                <p class="text-xs text-text-muted">Entrarás como</p>
                <p class="truncate font-medium text-text">{{ identity.name() }}</p>
              </div>
            </div>
            <button
              type="button"
              class="shrink-0 text-xs font-medium text-text-secondary transition hover:text-text"
              (click)="editing.set(true)"
            >
              Editar
            </button>
          </div>
        } @else {
          <div class="flex flex-col gap-2 text-left">
            <label for="hero-name" class="text-sm font-medium text-text-secondary"
              >¿Cómo te llamas?</label
            >
            <input
              id="hero-name"
              type="text"
              maxlength="20"
              autocomplete="off"
              autocorrect="off"
              spellcheck="false"
              class="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-center text-lg text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
              placeholder="Manuel"
              [ngModel]="draftName()"
              (ngModelChange)="draftName.set($event); tried.set(false)"
              (keydown.enter)="saveName()"
            />
            @if (showError()) {
              <p class="flex items-center gap-1.5 text-sm text-negative" role="alert">
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
                Introduce un nombre
              </p>
            }
            <app-button
              [fullWidth]="true"
              size="md"
              [disabled]="!draftName().trim()"
              (clickAction)="saveName()"
            >
              Continuar →
            </app-button>
          </div>
        }
      </div>

      <div
        class="animate-slide-up animation-delay-500 opacity-0 mt-6 flex w-full max-w-sm flex-col gap-3"
      >
        <app-button size="lg" [fullWidth]="true" (clickAction)="onCreate()">
          Crear partida
        </app-button>
        <app-button variant="secondary" size="lg" [fullWidth]="true" (clickAction)="onJoin()">
          Unirse a una partida
        </app-button>
      </div>

      <p class="animate-fade-in animation-delay-600 opacity-0 mt-8 text-xs text-text-muted">
        Sin registro · Gratis · Multijugador
      </p>
    </section>
  `,
})
export class HeroComponent {
  private readonly soundService = inject(SoundService);
  protected readonly identity = inject(PlayerIdentityService);

  readonly scrollToHowItWorks = input(false);
  readonly createAction = output<void>();
  readonly joinAction = output<void>();

  protected readonly editing = signal(false);
  protected readonly draftName = signal(this.identity.name());
  protected readonly tried = signal(false);

  protected readonly greeting = computed(
    () => this.identity.name().trim().length > 0 && !this.editing(),
  );
  protected readonly initials = computed(
    () => this.identity.name().trim().slice(0, 2).toUpperCase() || '?',
  );
  protected readonly showError = computed(() => this.tried() && !this.draftName().trim());

  protected saveName(): void {
    const trimmed = this.draftName().trim();
    if (!trimmed) {
      this.tried.set(true);
      return;
    }
    this.identity.setName(trimmed);
    this.soundService.play('click');
    this.editing.set(false);
  }

  protected onCreate(): void {
    this.soundService.play('click');
    this.createAction.emit();
  }

  protected onJoin(): void {
    this.soundService.play('click');
    this.joinAction.emit();
  }
}
