import {
  Component,
  afterNextRender,
  computed,
  input,
  model,
  output,
  signal,
  viewChild,
  ElementRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../../shared/components/ui/button.component';

@Component({
  selector: 'app-player-name-step',
  imports: [FormsModule, ButtonComponent],
  template: `
    <div class="flex flex-col items-center gap-5 text-center">
      <div
        class="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-xl font-bold text-white shadow-lg shadow-accent/20"
        aria-hidden="true"
      >
        {{ initials() }}
      </div>

      <div class="w-full text-left">
        <label for="player-name" class="mb-1.5 block text-sm font-medium text-text-secondary">
          ¿Cómo te llamas?
        </label>
        <input
          #input
          id="player-name"
          type="text"
          maxlength="20"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          class="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-center text-lg text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
          placeholder="Manuel"
          [ngModel]="name()"
          (ngModelChange)="name.set($event); tried.set(false)"
          (keydown.enter)="onContinue()"
        />
        @if (error()) {
          <p class="mt-2 flex items-center gap-1.5 text-sm text-negative" role="alert">
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
      </div>

      <app-button [fullWidth]="true" size="lg" (clickAction)="onContinue()">
        {{ continueLabel() }}
      </app-button>
    </div>
  `,
})
export class PlayerNameStepComponent {
  readonly name = model<string>('');
  readonly continueLabel = input<string>('Continuar →');
  readonly nextAction = output<void>();

  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('input');

  protected readonly tried = signal(false);
  protected readonly error = computed(() => this.tried() && !this.name().trim());
  protected readonly initials = computed(() => this.name().trim().slice(0, 2).toUpperCase() || '?');

  constructor() {
    afterNextRender(() => {
      this.inputRef()?.nativeElement.focus();
    });
  }

  protected onContinue(): void {
    if (!this.name().trim()) {
      this.tried.set(true);
      return;
    }
    this.nextAction.emit();
  }
}
