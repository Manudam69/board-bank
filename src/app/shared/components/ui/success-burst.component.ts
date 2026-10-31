import { Component, Service, inject, signal } from '@angular/core';

const BURST_MS = 1000;

/** Triggers the check-mark confirmation shown after an operation succeeds. */
@Service()
export class SuccessBurstService {
  readonly current = signal<number | null>(null);
  private nextId = 0;
  private timer?: ReturnType<typeof setTimeout>;

  show(): void {
    clearTimeout(this.timer);
    this.current.set(this.nextId++);
    this.timer = setTimeout(() => this.current.set(null), BURST_MS);
  }
}

@Component({
  selector: 'app-success-burst',
  template: `
    @for (id of visible(); track id) {
      <div
        class="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
        aria-hidden="true"
      >
        <div
          class="animate-burst flex h-24 w-24 items-center justify-center rounded-full bg-positive text-bg shadow-2xl shadow-black/50"
        >
          <svg
            class="h-12 w-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path class="animate-check-draw" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
    }
  `,
})
export class SuccessBurstComponent {
  private readonly service = inject(SuccessBurstService);
  protected readonly visible = () => {
    const id = this.service.current();
    return id === null ? [] : [id];
  };
}
