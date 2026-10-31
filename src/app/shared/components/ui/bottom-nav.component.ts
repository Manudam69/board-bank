import { Component, computed, input, model } from '@angular/core';
import { ICONS } from '../../icons';

export interface BottomNavItem {
  id: string;
  label: string;
  icon: string;
  badge?: number;
}

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  templateUrl: './bottom-nav.component.html',
})
export class BottomNavComponent {
  readonly items = input.required<BottomNavItem[]>();
  readonly activeItem = model.required<string>();
  protected readonly icons = ICONS;
  protected readonly activeIndex = computed(() =>
    Math.max(0, this.items().findIndex((item) => item.id === this.activeItem())),
  );
}
