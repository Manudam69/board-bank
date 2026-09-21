import { Component, DestroyRef, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { EditionService } from '../../core/services/edition.service';
import { GameStateService } from '../../core/services/game-state.service';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { PlayerCardComponent } from '../../shared/components/domain/player-card.component';
import { LogFeedComponent } from '../../shared/components/domain/log-feed.component';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [ButtonComponent, PlayerCardComponent, LogFeedComponent],
  templateUrl: './history.component.html',
})
export class HistoryComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly gameState = inject(GameStateService);
  private readonly editions = inject(EditionService);

  readonly roomId = toSignal(this.route.paramMap.pipe(map((p) => p.get('roomId') ?? '')));
  readonly room = this.gameState.room;
  readonly loading = this.gameState.loading;
  readonly error = this.gameState.error;

  readonly edition = computed(() => {
    const id = this.room()?.editionId;
    if (!id) return undefined;
    return this.editions.editions().find((e) => e.id === id);
  });

  readonly rankedPlayers = computed(() => {
    const edition = this.edition();
    if (!edition) return [];
    return [...(this.room()?.players ?? [])].sort((a, b) => {
      if (a.bankrupt !== b.bankrupt) {
        return a.bankrupt ? 1 : -1;
      }
      const netA = a.cash + a.properties.reduce((sum, pp) => {
        const meta = edition.properties.find((p) => p.id === pp.propertyId);
        return sum + (meta?.price ?? 0);
      }, 0);
      const netB = b.cash + b.properties.reduce((sum, pp) => {
        const meta = edition.properties.find((p) => p.id === pp.propertyId);
        return sum + (meta?.price ?? 0);
      }, 0);
      return netB - netA;
    });
  });

  constructor() {
    effect(() => {
      const id = this.roomId();
      if (id) this.gameState.subscribe(id);
    });

    this.destroyRef.onDestroy(() => this.gameState.unsubscribe());
  }
}
