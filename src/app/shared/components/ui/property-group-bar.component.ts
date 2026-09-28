import { Component, computed, input } from '@angular/core';
import { needsGroupBorder } from '../../utils/property-group';

@Component({
  selector: 'app-property-group-bar',
  imports: [],
  template: `
    <span
      class="inline-block h-6 w-1.5 shrink-0 rounded-full"
      [style.background-color]="groupColor()"
      [class.ring-1]="needsBorder()"
      [class.ring-border]="needsBorder()"
      aria-hidden="true"
    ></span>
  `,
})
export class PropertyGroupBarComponent {
  readonly groupColor = input.required<string>();

  protected needsBorder = computed(() => needsGroupBorder(this.groupColor()));
}
