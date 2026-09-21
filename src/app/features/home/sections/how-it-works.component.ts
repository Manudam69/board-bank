import { Component } from '@angular/core';
import { ICONS } from '../../../shared/icons';

@Component({
  selector: 'app-how-it-works',
  template: `
    <section id="como-funciona" class="px-4 py-16 sm:py-20">
      <div class="mx-auto max-w-4xl">
        <h2 class="mb-10 text-center text-2xl font-bold text-text sm:text-3xl">
          Juega sin preocuparte por el dinero.
        </h2>

        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          @for (step of steps; track step.number) {
            <div
              class="animate-slide-up opacity-0 rounded-2xl border border-border bg-surface p-5 transition hover:-translate-y-1 hover:border-accent/30"
              [class.animation-delay-100]="step.number === '01'"
              [class.animation-delay-200]="step.number === '02'"
              [class.animation-delay-300]="step.number === '03'"
              [class.animation-delay-400]="step.number === '04'"
            >
              <p class="mb-3 text-3xl font-bold text-accent/60">{{ step.number }}</p>
              <div
                class="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent-muted text-accent"
              >
                <svg
                  class="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="step.icon" />
                </svg>
              </div>
              <h3 class="mb-1 font-semibold text-text">{{ step.title }}</h3>
              <p class="text-sm leading-relaxed text-text-secondary">{{ step.description }}</p>
            </div>
          }
        </div>
      </div>
    </section>
  `,
})
export class HowItWorksComponent {
  protected readonly ICONS = ICONS;

  protected readonly steps = [
    {
      number: '01',
      title: 'Crea una partida',
      description: 'Crea una sala y comparte el código.',
      icon: ICONS['plus'],
    },
    {
      number: '02',
      title: 'Invita a tus amigos',
      description: 'Tus amigos entran desde su teléfono.',
      icon: ICONS['users'],
    },
    {
      number: '03',
      title: 'Juega',
      description: 'Compra propiedades, cobra alquileres y mueve tu dinero.',
      icon: ICONS['banknote'],
    },
    {
      number: '04',
      title: 'Board Bank se encarga del resto',
      description: 'Toda la partida queda registrada.',
      icon: ICONS['history'],
    },
  ];
}
