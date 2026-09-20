import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { EditionService } from '../../core/services/edition.service';
import { GameStateService } from '../../core/services/game-state.service';
import { RoomService } from '../../core/services/room.service';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { PlayerCardComponent } from '../../shared/components/domain/player-card.component';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [ButtonComponent, PlayerCardComponent],
  templateUrl: './lobby.component.html',
})
export class LobbyComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly gameState = inject(GameStateService);
  private readonly roomService = inject(RoomService);
  private readonly editions = inject(EditionService);
  private readonly auth = inject(AuthService);

  readonly roomId = toSignal(this.route.paramMap.pipe(map((p) => p.get('roomId') ?? '')));
  readonly room = this.gameState.room;
  readonly loading = this.gameState.loading;
  readonly error = this.gameState.error;

  readonly edition = computed(() => {
    const id = this.room()?.editionId;
    if (!id) return undefined;
    return this.editions.editions().find((e) => e.id === id);
  });

  readonly isHost = computed(() => {
    const userId = this.auth.userId();
    return this.room()?.hostId === userId;
  });

  readonly canStart = computed(() => (this.room()?.players.length ?? 0) >= 2);
  readonly starting = signal(false);
  readonly leaving = signal(false);
  readonly copied = signal(false);

  constructor() {
    effect(() => {
      const id = this.roomId();
      if (id) {
        this.gameState.subscribe(id);
      }
    });

    effect(() => {
      const room = this.room();
      if (room?.status === 'playing') {
        this.router.navigate(['/game', room.id]);
      }
    });

    this.destroyRef.onDestroy(() => this.gameState.unsubscribe());
  }

  protected async copyCode(): Promise<void> {
    const code = this.room()?.id;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.copied.set(false);
    }
  }

  protected async startGame(): Promise<void> {
    const room = this.room();
    const edition = this.edition();
    if (!room || !edition) return;

    this.starting.set(true);
    try {
      await this.roomService.startGame(room.id, edition.startingMoney);
    } finally {
      this.starting.set(false);
    }
  }

  protected async leave(): Promise<void> {
    const room = this.room();
    const userId = this.auth.userId();
    if (!room || !userId) return;

    this.leaving.set(true);
    try {
      await this.roomService.leaveRoom(room.id, userId);
      this.gameState.unsubscribe();
      this.router.navigate(['/']);
    } finally {
      this.leaving.set(false);
    }
  }
}
