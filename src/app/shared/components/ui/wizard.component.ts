import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { ButtonComponent } from './button.component';

const SLIDE_PX = 28;
const SLIDE_MS = 260;

/**
 * Guided multi-step flow for bottom sheets: progress bar, step title, animated body and a
 * footer pinned to the bottom with Back and the primary action. Steps themselves live in the
 * projected content; the owner decides which one is visible.
 *
 * Slots: default content (step body) and `[wizardSummary]` (a short line above the buttons).
 */
@Component({
  selector: 'app-wizard',
  imports: [ButtonComponent],
  template: `
    <div class="flex flex-col gap-4" [class.pb-4]="hideFooter()">
      <nav [attr.aria-label]="'Pasos: ' + steps().join(', ')">
        <ol class="flex items-start gap-1.5">
          @for (label of steps(); track $index) {
            <li class="flex flex-1 flex-col gap-1" [attr.aria-current]="$index === index() ? 'step' : null">
              <span
                class="h-1 rounded-full transition-colors duration-300"
                [class.bg-accent]="$index <= index()"
                [class.bg-border]="$index > index()"
                aria-hidden="true"
              ></span>
              <span
                class="text-[11px] font-medium"
                [class.text-text]="$index === index()"
                [class.text-text-secondary]="$index !== index()"
              >
                {{ $index + 1 }}. {{ label }}
              </span>
            </li>
          }
        </ol>
      </nav>

      <div #body class="flex flex-col gap-4">
        <div class="space-y-1">
          <h3 class="text-xl font-semibold text-text" aria-live="polite">{{ title() }}</h3>
          @if (hint()) {
            <p class="text-sm text-text-secondary">{{ hint() }}</p>
          }
        </div>
        <ng-content />
      </div>

      @if (!hideFooter()) {
        <footer class="sheet-footer">
          <ng-content select="[wizardSummary]" />
          <div class="flex gap-2">
            @if (showBack()) {
              <app-button variant="secondary" size="lg" [disabled]="busy()" (clickAction)="back.emit()">
                Atrás
              </app-button>
            }
            @if (!hidePrimary()) {
              <app-button
                class="min-w-0 flex-1"
                [fullWidth]="true"
                size="lg"
                [variant]="primaryVariant()"
                [loading]="busy()"
                [disabled]="primaryDisabled()"
                (clickAction)="next.emit()"
              >
                {{ primaryLabel() }}
              </app-button>
            }
          </div>
        </footer>
      }
    </div>
  `,
})
export class WizardComponent {
  readonly steps = input.required<string[]>();
  readonly index = input.required<number>();
  readonly title = input.required<string>();
  readonly hint = input('');
  readonly primaryLabel = input('Siguiente');
  readonly primaryDisabled = input(false);
  readonly primaryVariant = input<'primary' | 'danger'>('primary');
  readonly busy = input(false);
  /** Hide the primary button on steps that advance by tapping an option. */
  readonly hidePrimary = input(false);
  readonly hideFooter = input(false);
  readonly canGoBack = input(true);
  readonly back = output<void>();
  readonly next = output<void>();

  protected readonly showBack = computed(() => this.canGoBack() && this.index() > 0);

  private readonly body = viewChild<ElementRef<HTMLElement>>('body');
  private previousIndex: number | null = null;

  constructor() {
    effect(() => {
      const current = this.index();
      untracked(() => this.slide(current));
    });
  }

  private slide(current: number): void {
    const previous = this.previousIndex;
    this.previousIndex = current;
    const element = this.body()?.nativeElement;
    if (previous === null || previous === current || !element?.animate) return;
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const offset = current > previous ? SLIDE_PX : -SLIDE_PX;
    element.animate(
      [
        { opacity: 0.4, transform: `translateX(${offset}px)` },
        { opacity: 1, transform: 'translateX(0)' },
      ],
      { duration: SLIDE_MS, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    );
  }
}
