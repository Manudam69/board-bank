import { Component, input, model } from '@angular/core';

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
  badge?: number;
}

@Component({
  selector: 'app-tabs',
  standalone: true,
  templateUrl: './tabs.component.html',
})
export class TabsComponent {
  readonly tabs = input.required<TabItem[]>();
  readonly activeTab = model.required<string>();
}
