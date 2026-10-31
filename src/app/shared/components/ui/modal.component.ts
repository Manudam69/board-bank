import {
  Component,
  ElementRef,
  Injector,
  afterRenderEffect,
  effect,
  input,
  output,
  signal,
  untracked,
  viewChild,
  computed,
  OnDestroy,
} from '@angular/core';

const EXIT_MS = 230;
const DISMISS_DISTANCE_PX = 140;
const DISMISS_RATIO = 0.3;
const DISMISS_VELOCITY_PX_PER_MS = 0.6;
const DISMISS_VELOCITY_MIN_PX = 30;
const BACKDROP_ALPHA = 0.8;

@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
})
export class ModalComponent implements OnDestroy {
  readonly open = input.required<boolean>();
  readonly title = input('');
  readonly closeable = input(true);
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  readonly flushBottom = input(false);
  readonly closeAction = output<void>();

  protected readonly rendered = signal(false);
  protected readonly closing = signal(false);
  protected readonly dragY = signal(0);
  protected readonly dragging = signal(false);
  protected readonly frozenHeight = signal<number | null>(null);

  protected readonly panelTranslate = computed(() => (this.dragY() > 0 ? `0 ${this.dragY()}px` : null));
  protected readonly panelTransition = computed(() => {
    if (this.dragging()) return 'none';
    return this.dragY() > 0 ? 'translate 220ms cubic-bezier(0.16, 1, 0.3, 1)' : null;
  });
  protected readonly backdropColor = computed(() => {
    const dy = this.dragY();
    if (dy <= 0) return null;
    const progress = Math.min(1, dy / (this.panelHeight || 1));
    return `rgb(0 0 0 / ${(BACKDROP_ALPHA * (1 - progress)).toFixed(3)})`;
  });
  protected readonly backdropTransition = computed(() =>
    !this.dragging() && this.dragY() > 0 ? 'background-color 220ms ease-out' : null,
  );

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private previousActiveElement: Element | null = null;
  private lastHeight = 0;
  private panelHeight = 0;
  private exitTimer?: ReturnType<typeof setTimeout>;
  protected dragDismissed = false;

  private dragPointerId: number | null = null;
  private dragStartY = 0;
  private dragSamples: { y: number; t: number }[] = [];

  constructor(
    private readonly elementRef: ElementRef,
    private readonly injector: Injector,
  ) {
    effect(() => {
      const isOpen = this.open();
      untracked(() => this.syncVisibility(isOpen));
    });

    // Remember the sheet's height while it is open so it keeps its shape while sliding out
    // after the parent has already emptied the projected content.
    effect((onCleanup) => {
      const element = this.panel()?.nativeElement;
      if (!element || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => {
        if (this.open()) {
          this.lastHeight = element.offsetHeight;
        }
      });
      observer.observe(element);
      onCleanup(() => observer.disconnect());
    });

    afterRenderEffect(
      () => {
        if (this.open()) {
          this.previousActiveElement = document.activeElement;
          const dialog = this.elementRef.nativeElement.querySelector(
            '[role="dialog"]',
          ) as HTMLElement | null;
          const closeButton = dialog?.querySelector(
            'button[aria-label="Cerrar"]',
          ) as HTMLElement | null;
          (closeButton ?? dialog)?.focus();
          this.syncBodyScrollLock();
        } else {
          this.syncBodyScrollLock();
          if (this.previousActiveElement instanceof HTMLElement) {
            this.previousActiveElement.focus();
          }
        }
      },
      { injector: this.injector },
    );

    afterRenderEffect(
      () => {
        this.rendered();
        this.syncBodyScrollLock();
      },
      { injector: this.injector },
    );
  }

  ngOnDestroy(): void {
    clearTimeout(this.exitTimer);
    queueMicrotask(() => this.syncBodyScrollLock());
  }

  private syncVisibility(isOpen: boolean): void {
    clearTimeout(this.exitTimer);
    if (isOpen) {
      this.rendered.set(true);
      this.closing.set(false);
      this.dragDismissed = false;
      this.dragY.set(0);
      this.frozenHeight.set(null);
      return;
    }
    if (!this.rendered()) return;

    this.frozenHeight.set(this.lastHeight || null);
    this.closing.set(true);
    this.exitTimer = setTimeout(() => {
      this.rendered.set(false);
      this.closing.set(false);
      this.dragY.set(0);
      this.frozenHeight.set(null);
    }, EXIT_MS);
  }

  private syncBodyScrollLock(): void {
    const hasOpenDialog = document.querySelector('[role="dialog"]:not([data-closing])') !== null;
    document.body.classList.toggle('overflow-hidden', hasOpenDialog);
  }

  protected dialogClasses(): string {
    const map: Record<string, string> = {
      sm: 'sm:max-w-sm',
      md: 'sm:max-w-lg',
      lg: 'sm:max-w-2xl',
      xl: 'sm:max-w-4xl',
    };
    const motion = this.closing()
      ? this.dragDismissed
        ? ''
        : 'animate-sheet-out'
      : 'animate-sheet-in';
    return `relative flex w-full flex-col overflow-hidden rounded-t-3xl sm:rounded-modal bg-surface sm:border border-border shadow-2xl shadow-black/40 max-h-[92dvh] sm:max-h-[85dvh] ${map[this.size()]} ${motion}`;
  }

  protected backdropClasses(): string {
    const fade = this.closing() ? 'animate-backdrop-out' : '';
    return `fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4 ${fade}`;
  }

  protected close(): void {
    if (this.closeable()) {
      this.lastHeight = this.panel()?.nativeElement.offsetHeight || this.lastHeight;
      this.closeAction.emit();
    }
  }

  protected onKeydown(event: Event): void {
    if ((event as KeyboardEvent).key === 'Escape') {
      this.close();
    }
  }

  protected onDragStart(event: PointerEvent): void {
    if (!this.closeable() || this.closing() || this.dragPointerId !== null) return;
    if (event.pointerType === 'mouse') return;
    if (!window.matchMedia('(max-width: 639px)').matches) return;
    if ((event.target as Element).closest('button')) return;

    this.dragPointerId = event.pointerId;
    this.dragStartY = event.clientY;
    this.dragSamples = [{ y: event.clientY, t: event.timeStamp }];
    this.panelHeight = this.panel()?.nativeElement.offsetHeight ?? 0;
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // Capture is only an optimisation; the drag still works without it.
    }
    this.dragging.set(true);
  }

  protected onDragMove(event: PointerEvent): void {
    if (event.pointerId !== this.dragPointerId) return;
    this.dragY.set(Math.max(0, event.clientY - this.dragStartY));
    this.dragSamples.push({ y: event.clientY, t: event.timeStamp });
    if (this.dragSamples.length > 4) this.dragSamples.shift();
  }

  protected onDragEnd(event: PointerEvent, cancelled = false): void {
    if (event.pointerId !== this.dragPointerId) return;
    this.dragPointerId = null;
    this.dragging.set(false);

    const distance = this.dragY();
    const first = this.dragSamples[0];
    const last = this.dragSamples[this.dragSamples.length - 1];
    const elapsed = last.t - first.t;
    const velocity = elapsed > 0 ? (last.y - first.y) / elapsed : 0;

    const shouldDismiss =
      !cancelled &&
      (distance > Math.min(DISMISS_DISTANCE_PX, this.panelHeight * DISMISS_RATIO) ||
        (velocity > DISMISS_VELOCITY_PX_PER_MS && distance > DISMISS_VELOCITY_MIN_PX));

    if (shouldDismiss) {
      this.dragDismissed = true;
      this.dragY.set(this.panelHeight);
      this.close();
    } else {
      this.dragY.set(0);
    }
  }
}
