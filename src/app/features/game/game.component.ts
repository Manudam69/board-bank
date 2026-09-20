import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { BankService } from '../../core/services/bank.service';
import { EditionService } from '../../core/services/edition.service';
import { GameStateService } from '../../core/services/game-state.service';
import { PropertyService } from '../../core/services/property.service';
import { TradeService } from '../../core/services/trade.service';
import { RoomService } from '../../core/services/room.service';
import { BankActionsBarComponent, type BankAction } from '../../shared/components/domain/bank-actions-bar.component';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { ModalComponent } from '../../shared/components/ui/modal.component';
import { SpinnerComponent } from '../../shared/components/ui/spinner.component';
import { TabsComponent } from '../../shared/components/ui/tabs.component';
import { PlayerCardComponent } from '../../shared/components/domain/player-card.component';
import { PlayerDashboardComponent } from '../../shared/components/domain/player-dashboard.component';
import { PropertyCardComponent } from '../../shared/components/domain/property-card.component';
import { TransferPanelComponent } from '../../shared/components/domain/transfer-panel.component';
import { BuyPropertyPanelComponent } from '../../shared/components/domain/buy-property-panel.component';
import { MortgagePanelComponent } from '../../shared/components/domain/mortgage-panel.component';
import { BuildPanelComponent } from '../../shared/components/domain/build-panel.component';
import { RentPanelComponent } from '../../shared/components/domain/rent-panel.component';
import { TradeBuilderComponent } from '../../shared/components/domain/trade-builder.component';
import { TradeListComponent } from '../../shared/components/domain/trade-list.component';
import { LogFeedComponent } from '../../shared/components/domain/log-feed.component';
import { MoneyDisplayComponent } from '../../shared/components/domain/money-display.component';
import { mapFirebaseError } from '../../core/utils/firebase-errors';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [
    FormsModule,
    ButtonComponent,
    ModalComponent,
    SpinnerComponent,
    TabsComponent,
    PlayerCardComponent,
    PlayerDashboardComponent,
    PropertyCardComponent,
    TransferPanelComponent,
    BuyPropertyPanelComponent,
    MortgagePanelComponent,
    BuildPanelComponent,
    RentPanelComponent,
    TradeBuilderComponent,
    TradeListComponent,
    LogFeedComponent,
    MoneyDisplayComponent,
    BankActionsBarComponent,
  ],
  templateUrl: './game.component.html',
})
export class GameComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly gameState = inject(GameStateService);
  private readonly editions = inject(EditionService);
  private readonly bank = inject(BankService);
  private readonly properties = inject(PropertyService);
  private readonly tradeService = inject(TradeService);
  private readonly roomService = inject(RoomService);
  private readonly auth = inject(AuthService);

  readonly roomId = toSignal(this.route.paramMap.pipe(map((p) => p.get('roomId') ?? '')));
  readonly room = this.gameState.room;
  readonly loading = this.gameState.loading;
  readonly error = this.gameState.error;
  readonly authReady = this.auth.ready;

  readonly edition = computed(() => {
    const id = this.room()?.editionId;
    if (!id) return undefined;
    return this.editions.editions().find((e) => e.id === id);
  });

  readonly currentPlayer = computed(() => {
    const userId = this.auth.userId();
    return this.room()?.players.find((player) => player.id === userId);
  });

  readonly isInRoom = computed(() => !!this.currentPlayer());
  readonly isHost = computed(() => {
    const userId = this.auth.userId();
    return this.room()?.hostId === userId;
  });

  readonly joinName = signal('');
  readonly joining = signal(false);
  readonly activeTab = signal('me');
  readonly activeAction = signal<BankAction | null>(null);
  readonly busy = signal(false);
  readonly toast = signal('');

  constructor() {
    effect(() => {
      const id = this.roomId();
      if (id) this.gameState.subscribe(id);
    });

    effect(() => {
      const room = this.room();
      if (room?.status === 'finished') {
        this.router.navigate(['/history', room.id]);
      }
    });

    this.destroyRef.onDestroy(() => this.gameState.unsubscribe());
  }

  protected openAction(action: BankAction): void {
    this.activeAction.set(action);
  }

  protected closeAction(): void {
    this.activeAction.set(null);
  }

  private async runOp(op: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.toast.set('');
    try {
      await op();
      this.activeAction.set(null);
    } catch (e) {
      this.toast.set(mapFirebaseError(e));
    } finally {
      this.busy.set(false);
    }
  }

  private requireCurrentPlayer(): string {
    const id = this.currentPlayer()?.id;
    if (!id) throw new Error('No estás en esta sala');
    return id;
  }

  protected onTransfer(data: { toId: string | 'bank'; amount: number; reason: string }): void {
    const roomId = this.roomId();
    const me = this.requireCurrentPlayer();
    if (!roomId) return;
    this.runOp(() => this.bank.transfer(roomId, me, data.toId, data.amount, data.reason));
  }

  protected onBuy(data: { propertyId: string }): void {
    const roomId = this.roomId();
    const edition = this.edition();
    const me = this.requireCurrentPlayer();
    if (!roomId || !edition) return;
    this.runOp(() => this.properties.buyProperty(roomId, edition, me, data.propertyId));
  }

  protected onRent(data: { propertyId: string; amount: number }): void {
    const roomId = this.roomId();
    const room = this.room();
    const me = this.requireCurrentPlayer();
    const owner = room?.players.find((player) =>
      player.properties.some((pp) => pp.propertyId === data.propertyId),
    );
    if (!roomId || !owner) return;
    this.runOp(() =>
      this.bank.transfer(
        roomId,
        me,
        owner.id,
        data.amount,
        `Alquiler de ${this.edition()?.properties.find((p) => p.id === data.propertyId)?.name ?? ''}`,
      ),
    );
  }

  protected onMortgage(data: { propertyId: string }): void {
    const roomId = this.roomId();
    const edition = this.edition();
    const me = this.requireCurrentPlayer();
    if (!roomId || !edition) return;
    this.runOp(() => this.properties.mortgage(roomId, edition, me, data.propertyId));
  }

  protected onUnmortgage(data: { propertyId: string }): void {
    const roomId = this.roomId();
    const edition = this.edition();
    const me = this.requireCurrentPlayer();
    if (!roomId || !edition) return;
    this.runOp(() => this.properties.unmortgage(roomId, edition, me, data.propertyId));
  }

  protected onBuild(data: { propertyId: string; mode: 'house' | 'hotel' | 'sell-house' | 'sell-hotel' }): void {
    const roomId = this.roomId();
    const edition = this.edition();
    const me = this.requireCurrentPlayer();
    if (!roomId || !edition) return;
    this.runOp(async () => {
      switch (data.mode) {
        case 'house':
          await this.properties.buildHouses(roomId, edition, me, data.propertyId, 1);
          break;
        case 'hotel':
          await this.properties.buildHotel(roomId, edition, me, data.propertyId);
          break;
        case 'sell-house':
          await this.properties.sellHouses(roomId, edition, me, data.propertyId, 1);
          break;
        case 'sell-hotel':
          await this.properties.sellHotel(roomId, edition, me, data.propertyId);
          break;
      }
    });
  }

  protected onBankSalary(): void {
    const roomId = this.roomId();
    const edition = this.edition();
    const me = this.requireCurrentPlayer();
    if (!roomId || !edition) return;
    this.runOp(() => this.bank.payFromBank(roomId, me, edition.goSalary, 'Sueldo por salida'));
  }

  protected onBankTax(type: 'income' | 'luxury'): void {
    const roomId = this.roomId();
    const edition = this.edition();
    const me = this.requireCurrentPlayer();
    if (!roomId || !edition) return;
    const amount = type === 'income' ? edition.incomeTax : edition.luxuryTax;
    const name = type === 'income' ? 'Impuesto sobre la renta' : 'Impuesto de lujo';
    this.runOp(() => this.bank.payTax(roomId, me, amount, name));
  }

  protected onDeclareBankruptcy(): void {
    const roomId = this.roomId();
    const me = this.requireCurrentPlayer();
    if (!roomId) return;
    this.runOp(() => this.bank.declareBankruptcy(roomId, me));
  }

  protected onProposeTrade(data: {
    toId: string;
    fromCash: number;
    toCash: number;
    fromProperties: string[];
    toProperties: string[];
  }): void {
    const roomId = this.roomId();
    const me = this.requireCurrentPlayer();
    if (!roomId) return;
    this.runOp(() =>
      this.tradeService.create(
        roomId,
        me,
        data.toId,
        { cash: data.fromCash, propertyIds: data.fromProperties },
        { cash: data.toCash, propertyIds: data.toProperties },
      ),
    );
  }

  protected acceptTrade(offerId: string): void {
    const roomId = this.roomId();
    if (!roomId) return;
    this.runOp(() => this.tradeService.accept(roomId, offerId));
  }

  protected rejectTrade(offerId: string): void {
    const roomId = this.roomId();
    if (!roomId) return;
    this.runOp(() => this.tradeService.reject(roomId, offerId));
  }

  protected async finishGame(): Promise<void> {
    const roomId = this.roomId();
    if (!roomId) return;
    await this.gameState.runInTransaction(roomId, (room) => ({ ...room, status: 'finished' }));
    this.router.navigate(['/history', roomId]);
  }

  protected async leave(): Promise<void> {
    const roomId = this.roomId();
    const me = this.requireCurrentPlayer();
    if (!roomId) return;
    await this.roomService.leaveRoom(roomId, me);
    this.gameState.unsubscribe();
    this.router.navigate(['/']);
  }

  protected async joinGame(): Promise<void> {
    const roomId = this.roomId();
    const name = this.joinName().trim();
    if (!roomId || !name) return;
    this.joining.set(true);
    try {
      await this.roomService.joinRoom(roomId, name);
    } catch (e) {
      this.toast.set(mapFirebaseError(e));
    } finally {
      this.joining.set(false);
    }
  }

  protected openTransferTo(playerId: string): void {
    // TODO: prefill transfer modal with player as destination.
    this.activeAction.set('transfer');
  }
}
