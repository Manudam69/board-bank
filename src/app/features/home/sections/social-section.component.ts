import { Component } from '@angular/core';

@Component({
  selector: 'app-social-section',
  template: `
    <section class="px-4 py-16 sm:py-20">
      <div class="mx-auto max-w-4xl">
        <div class="rounded-2xl border border-border bg-surface p-6 text-center sm:p-10">
          <p class="text-xl font-semibold text-text sm:text-2xl">Deja los billetes de papel.</p>
          <p class="mt-3 text-text-secondary">Una partida. Todos los jugadores. Un solo lugar.</p>
          <p class="mt-1 text-sm text-text-muted">
            Cada jugador controla su dinero desde su propio teléfono.
          </p>

          <div class="mt-6 flex items-center justify-center -space-x-2">
            @for (color of avatarColors; track $index) {
              <div
                class="flex h-9 w-9 items-center justify-center rounded-full border-2 border-surface text-xs font-bold text-white"
                [class]="color"
                aria-hidden="true"
              >
                {{ initials[$index] }}
              </div>
            }
          </div>
        </div>
      </div>
    </section>
  `,
})
export class SocialSectionComponent {
  protected readonly avatarColors = [
    'bg-red-500',
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
  ];
  protected readonly initials = ['M', 'C', 'A', 'L', 'P'];
}
