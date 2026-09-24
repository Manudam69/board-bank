import { Component, computed, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { EditionService } from '../../../core/services/edition.service';
import { SoundService } from '../../../core/services/sound.service';
import { ButtonComponent } from '../ui/button.component';
import { SpacedCodePipe } from '../../pipes/spaced-code.pipe';
import type { Room } from '../../../core/models';

@Component({
  selector: 'app-rejoin-banner',
  imports: [ButtonComponent, SpacedCodePipe],
  template: `
    <section
      class="animate-fade-in w-full rounded-2xl border border-accent/30 bg-accent-muted p-5 shadow-sm"
      role="status"
      aria-label="Tienes una partida en curso"
    >
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-accent">Tienes una partida en curso</p>
          <p class="mt-1 text-2xl font-black tracking-[0.3em] text-text">
            {{ room().id | spacedCode }}
          </p>
          @if (editionName()) {
            <p class="mt-0.5 text-xs text-text-secondary">{{ editionName() }}</p>
          }
        </div>

        <div class="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <app-button (clickAction)="rejoin()">Volver a la partida</app-button>
          <app-button variant="ghost" size="sm" (clickAction)="dismiss()">Ignorar</app-button>
        </div>
      </div>
    </section>
  `,
})
export class RejoinBannerComponent {
  private readonly router = inject(Router);
  private readonly soundService = inject(SoundService);
  private readonly editions = inject(EditionService);

  readonly room = input.required<Room>();
  readonly dismissAction = output<void>();

  readonly editionName = computed(() => {
    const id = this.room().editionId;
    return this.editions.editions().find((e) => e.id === id)?.name;
  });

  protected rejoin(): void {
    this.soundService.play('click');
    this.router.navigate(['/join', this.room().id]);
  }

  protected dismiss(): void {
    this.soundService.play('click');
    this.dismissAction.emit();
  }
}
