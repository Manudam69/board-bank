import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HapticsService } from './core/services/haptics.service';
import { RoomJanitorService } from './core/services/room-janitor.service';

@Component({
  imports: [RouterOutlet],
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
