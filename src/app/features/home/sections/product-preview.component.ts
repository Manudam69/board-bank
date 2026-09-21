import { Component } from '@angular/core';

@Component({
  selector: 'app-product-preview',
  template: `
    <section class="overflow-hidden px-4 py-16 sm:py-20">
      <div class="mx-auto max-w-5xl">
        <h2 class="mb-8 text-center text-2xl font-bold text-text sm:text-3xl">
          Así se ve la partida cuando juegas.
        </h2>

        <div class="flex justify-center">
          <div
            class="relative w-full max-w-sm animate-float-slow rounded-[2.5rem] border-4 border-surface-elevated bg-surface p-3 shadow-2xl shadow-black/30"
          >
            <div class="rounded-[2rem] bg-bg p-5">
              <div class="mb-4 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div
                    class="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-white"
                  >
                    MD
                  </div>
                  <span class="text-sm font-medium text-text">Manuel</span>
                </div>
                <span class="text-xs text-text-muted">Turno 4</span>
              </div>

              <div class="mb-6 text-center">
                <p class="text-sm text-text-secondary">Tu dinero</p>
                <p class="text-4xl font-extrabold text-positive">€2.318</p>
              </div>

              <div class="mb-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  class="rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-white"
                >
                  Transferir
                </button>
                <button
                  type="button"
                  class="rounded-xl bg-surface-elevated px-3 py-2.5 text-sm font-semibold text-text"
                >
                  Comprar
                </button>
              </div>

              <div class="space-y-2">
                <div
                  class="flex items-center justify-between rounded-lg bg-surface-elevated/50 px-3 py-2"
                >
                  <span class="text-sm text-text-secondary">Ronda</span>
                  <span class="text-sm font-medium text-text">+€60</span>
                </div>
                <div
                  class="flex items-center justify-between rounded-lg bg-surface-elevated/50 px-3 py-2"
                >
                  <span class="text-sm text-text-secondary">Alquiler a Carlos</span>
                  <span class="text-sm font-medium text-positive">+€150</span>
                </div>
                <div
                  class="flex items-center justify-between rounded-lg bg-surface-elevated/50 px-3 py-2"
                >
                  <span class="text-sm text-text-secondary">Impuesto de lujo</span>
                  <span class="text-sm font-medium text-negative">−€100</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class ProductPreviewComponent {}
