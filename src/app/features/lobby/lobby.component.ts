import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { EditionService } from '../../core/services/edition.service';
import { GameStateService } from '../../core/services/game-state.service';
import { RoomService } from '../../core/services/room.service';
import { SoundService } from '../../core/services/sound.service';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { ConfirmDialogComponent } from '../../shared/components/ui/confirm-dialog.component';
import { QrCodeComponent } from '../../shared/components/ui/qr-code.component';
import { SpinnerComponent } from '../../shared/components/ui/spinner.component';
import { SpacedCodePipe } from '../../shared/pipes/spaced-code.pipe';

const MAX_PLAYERS = 8;

@Component({
  selector: 'app-lobby',
  imports: [ButtonComponent, ConfirmDialogComponent, QrCodeComponent, SpinnerComponent, SpacedCodePipe],
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
  private readonly soundService = inject(SoundService);

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
  readonly linkCopied = signal(false);
  readonly confirmLeaveOpen = signal(false);
  readonly showStartOverlay = signal(false);
  protected readonly MAX_PLAYERS = MAX_PLAYERS;

  readonly inviteUrl = computed(() => {
    const id = this.room()?.id;
    if (!id) return '';
    const base = document.baseURI.replace(/\/$/, '');
    return `${base}/join/${id}`;
  });

  readonly canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  readonly ghostSlots = computed(() => {
    const count = this.room()?.players.length ?? 0;
    return Math.max(0, MAX_PLAYERS - count);
  });

  readonly ghostSlotsArray = computed(() => Array.from({ length: Math.min(this.ghostSlots(), 4) }));

  // Track previous player count to play a sound only when someone joins.
  private readonly previousPlayerCount = linkedSignal(() => this.room()?.players.length ?? 0);

  constructor() {
    effect(() => {
      const id = this.roomId();
      if (id) {
        this.gameState.subscribe(id);
      }
    });

    effect(() => {
      const room = this.room();
      if (!room) return;

      const previous = this.previousPlayerCount();
      const current = room.players.length;
      if (previous > 0 && current > previous) {
        this.soundService.play('notify');
      }
      this.previousPlayerCount.set(current);
    });

    effect(() => {
      const room = this.room();
      if (room?.status === 'playing' && !this.showStartOverlay()) {
        this.soundService.play('start');
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.showStartOverlay.set(true);
        const delay = prefersReducedMotion ? 0 : 700;
        setTimeout(() => this.router.navigate(['/game', room.id]), delay);
      }
    });

    this.destroyRef.onDestroy(() => this.gameState.unsubscribe());
  }

  protected playerJoinedAtIndex(index: number): number {
    const players = this.room()?.players;
    if (!players) return 0;
    return players[index]?.joinedAt ?? 0;
  }

  protected playerInitials(name: string): string {
    return name.trim().slice(0, 2).toUpperCase() || '?';
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

  protected async copyLink(): Promise<void> {
    const url = this.inviteUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    } catch {
      this.linkCopied.set(false);
    }
  }

  protected async shareInvite(): Promise<void> {
    const url = this.inviteUrl();
    if (!url || !this.canShare) return;
    try {
      await navigator.share({
        title: 'BoardBank',
        text: 'Únete a mi partida de BoardBank',
        url,
      });
    } catch {
      // Usuario canceló o falló; no mostrar error.
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

  protected promptLeave(): void {
    this.confirmLeaveOpen.set(true);
  }

  protected async onLeaveConfirmed(confirmed: boolean): Promise<void> {
    this.confirmLeaveOpen.set(false);
    if (!confirmed) return;

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
