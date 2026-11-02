import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { HapticsService } from '../../../core/services/haptics.service';
import { ICONS } from '../../icons';

const REFRESH_DISTANCE = 72;
const PULL_RESISTANCE = 0.5;
const REFRESH_TIMEOUT_MS = 10_000;

@Component({
  selector: 'app-pull-refresh',
  host: { class: 'block' },
  template: `
    <ng-content />
    <div
      class="pointer-events-none fixed inset-x-4 top-[calc(var(--safe-top)+0.75rem)] z-[100] flex justify-center"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      @if (distance() > 0 || refreshing() || message()) {
        <div class="pull-refresh-indicator flex max-w-sm items-center gap-2 rounded-full border border-border bg-surface p-3 text-sm text-text shadow-lg"
          animate.enter="pull-refresh-enter"
          animate.leave="pull-refresh-leave"
          [class.pull-refresh-dragging]="distance() > 0"
          [class.pull-refresh-success]="succeeded()"
          [style.transform]="'translateY(' + (refreshing() || message() ? 0 : distance() / 3) + 'px)'">
          <span class="relative h-5 w-5 shrink-0">
          <span class="pull-refresh-arrow absolute inset-0 flex"
            [style.rotate]="distance() * 3 + 'deg'">
          <svg class="h-5 w-5 text-accent-focus"
            [class.animate-spin]="refreshing()" [class.motion-reduce:animate-none]="refreshing()"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="icons['rotate-ccw']" />
          </svg>
          </span>
          @if (succeeded()) {
            <svg class="pull-refresh-check absolute inset-0 h-5 w-5 text-positive"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
              <path pathLength="1" stroke-linecap="round" stroke-linejoin="round" [attr.d]="icons['check']" />
            </svg>
          }
          </span>
          <span data-refresh-label class="min-w-0 text-sm leading-snug" [class.sr-only]="!message() || message() === 'Datos actualizados'">{{ label() }}</span>
        </div>
      }
    </div>
    @if (enabled()) {
      <button type="button"
        class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[101] focus:rounded-xl focus:bg-surface focus:p-3 focus:text-text focus:outline-accent"
        [disabled]="refreshing()" (click)="runRefresh()">
        Recargar aplicación
      </button>
    }
  `,
})
export class PullRefreshComponent {
  readonly refresh = input.required<() => Promise<void>>();
  readonly enabled = input(true);
  readonly pageKey = input<unknown>();
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly haptics = inject(HapticsService);
  protected readonly icons = ICONS;
  protected readonly distance = signal(0);
  protected readonly refreshing = signal(false);
  protected readonly message = signal('');
  protected readonly succeeded = computed(() => this.message() === 'Datos actualizados');
  protected readonly label = computed(() => this.message() || (this.refreshing()
    ? 'Actualizando...'
    : this.distance() >= REFRESH_DISTANCE ? 'Suelta para actualizar' : 'Desliza para actualizar'));

  private start: { x: number; y: number; id: number; target: Element } | null = null;
  private locked = false;
  private version = 0;
  private messageTimer?: ReturnType<typeof setTimeout>;
  private alive = true;

  constructor() {
    const options = { capture: true, passive: false };
    const start = (event: TouchEvent) => this.onStart(event);
    const move = (event: TouchEvent) => this.onMove(event);
    const end = () => this.onEnd();
    const cancel = () => this.resetGesture();
    this.document.addEventListener('touchstart', start, options);
    this.document.addEventListener('touchmove', move, options);
    this.document.addEventListener('touchend', end, options);
    this.document.addEventListener('touchcancel', cancel, options);
    effect(() => {
      this.pageKey();
      this.enabled();
      this.version++;
      this.resetGesture();
      this.refreshing.set(false);
      this.message.set('');
      clearTimeout(this.messageTimer);
    });
    this.destroyRef.onDestroy(() => {
      this.alive = false;
      this.version++;
      clearTimeout(this.messageTimer);
      this.document.removeEventListener('touchstart', start, options);
      this.document.removeEventListener('touchmove', move, options);
      this.document.removeEventListener('touchend', end, options);
      this.document.removeEventListener('touchcancel', cancel, options);
    });
  }

  private onStart(event: TouchEvent): void {
    this.resetGesture();
    if (!this.enabled() || this.refreshing() || event.touches.length !== 1 ||
      !this.document.defaultView?.matchMedia('(max-width: 767px)').matches ||
      this.document.querySelector('[role="dialog"]')) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest('button, a, input, textarea, select, [contenteditable], [data-no-swipe]') ||
      !this.atTop(target)) return;
    const touch = event.touches[0];
    this.start = { x: touch.clientX, y: touch.clientY, id: touch.identifier, target };
  }

  private onMove(event: TouchEvent): void {
    if (!this.start) return;
    if (event.touches.length !== 1 || this.document.querySelector('[role="dialog"]')) {
      this.resetGesture();
      return;
    }
    const touch = event.touches[0];
    if (touch.identifier !== this.start.id) return;
    const dx = touch.clientX - this.start.x;
    const dy = touch.clientY - this.start.y;
    if (!this.locked) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) {
        if (dy > 0 && dy > Math.abs(dx) * 1.4 && event.cancelable) event.preventDefault();
        return;
      }
      if (dy <= 0 || dy < Math.abs(dx) * 1.4 || !this.atTop(this.start.target)) {
        this.resetGesture();
        return;
      }
      this.locked = true;
      this.message.set('');
      clearTimeout(this.messageTimer);
    }
    if (!event.cancelable) {
      this.resetGesture();
      return;
    }
    event.preventDefault();
    this.distance.set(Math.min(100, Math.max(0, dy * PULL_RESISTANCE)));
  }

  private onEnd(): void {
    const committed = this.locked && this.distance() >= REFRESH_DISTANCE;
    this.resetGesture();
    if (committed) void this.runRefresh();
  }

  private atTop(target: Element): boolean {
    for (let element: Element | null = target; element; element = element.parentElement) {
      if (element.scrollTop > 0) return false;
    }
    return (this.document.scrollingElement?.scrollTop ?? 0) <= 0;
  }

  private resetGesture(): void {
    this.start = null;
    this.locked = false;
    this.distance.set(0);
  }

  protected async runRefresh(): Promise<void> {
    if (!this.enabled() || this.refreshing()) return;
    const version = ++this.version;
    clearTimeout(this.messageTimer);
    this.refreshing.set(true);
    this.message.set('');
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      this.haptics.play('selection');
      await Promise.race([
        this.refresh()(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error('La actualización no respondió en 10 segundos.')),
            REFRESH_TIMEOUT_MS,
          );
        }),
      ]);
      if (this.alive && version === this.version) this.message.set('Datos actualizados');
    } catch (error) {
      if (this.alive && version === this.version) {
        console.error('Error al actualizar los datos:', error);
        this.message.set('No se pudo actualizar. Reintenta.');
        this.haptics.play('error');
      }
    } finally {
      clearTimeout(timeout);
      if (this.alive && version === this.version) {
        this.refreshing.set(false);
        this.messageTimer = setTimeout(
          () => this.message.set(''),
          this.message() === 'Datos actualizados' ? 400 : 5000,
        );
      }
    }
  }
}
