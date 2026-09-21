import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { RoomJanitorService } from './core/services/room-janitor.service';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('board-bank');

  constructor() {
    const janitor = inject(RoomJanitorService);
    janitor.cleanStaleRooms().catch(() => {
      // Ignore janitor failures on startup so they never block app boot.
    });
  }
}
