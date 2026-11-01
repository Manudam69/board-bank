import { Component, computed, input } from '@angular/core';

const SIZES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
} as const;

/** Round avatar with the player's initials; `color` is a Tailwind background class such as `bg-red-500`. */
@Component({
  selector: 'app-player-avatar',
  template: `
    <span
      class="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white {{ color() }} {{ sizeClass() }}"
      aria-hidden="true"
    >
      {{ initials() }}
    </span>
  `,
})
export class PlayerAvatarComponent {
  readonly name = input.required<string>();
  readonly color = input('bg-slate-500');
  readonly size = input<keyof typeof SIZES>('md');

  protected readonly sizeClass = computed(() => SIZES[this.size()]);
  protected readonly initials = computed(() => this.name().trim().slice(0, 2).toUpperCase() || '?');
}
