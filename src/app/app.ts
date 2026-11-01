import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HapticsService } from './core/services/haptics.service';
import { RoomJanitorService } from './core/services/room-janitor.service';
import { PullRefreshComponent } from './shared/components/ui/pull-refresh.component';

interface RefreshablePage {
  refreshData(): Promise<void>;
}

@Component({
  imports: [RouterOutlet, PullRefreshComponent],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
  host: {
    '(document:pointerdown)': 'onPointerDown($event)',
  },
})
export class App {
  protected readonly title = signal('board-bank');
  private readonly haptics = inject(HapticsService);
  protected readonly activePage = signal<RefreshablePage | null>(null);
  protected readonly refreshPage = async (): Promise<void> => {
    const page = this.activePage();
    if (!page) throw new Error('Espera a que termine de cargar la pantalla.');
    await page.refreshData();
  };

  protected onPageActivate(page: unknown): void {
    this.activePage.set(
      typeof page === 'object' && page !== null &&
      'refreshData' in page && typeof page.refreshData === 'function'
        ? page as RefreshablePage : null,
    );
  }

  constructor() {
    const janitor = inject(RoomJanitorService);
    janitor.cleanStaleRooms().catch(() => {
      // Ignore janitor failures on startup so they never block app boot.
    });
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.pointerType !== 'touch') return;
    const target = event.target instanceof Element ? event.target : null;
    const control = target?.closest('button, [role="button"], [role="radio"], [role="menuitem"]');
    if (!control || (control as HTMLButtonElement).disabled) return;
    if (control.getAttribute('aria-disabled') === 'true') return;
    this.haptics.play(control.getAttribute('role') === 'radio' ? 'selection' : 'tap');
  }
}
