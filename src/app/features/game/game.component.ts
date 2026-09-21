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
import { ToastService } from '../../core/services/toast.service';
import { SoundService } from '../../core/services/sound.service';
import { UndoService } from '../../core/services/undo.service';
import {
  BankActionsBarComponent,
  type BankAction,
} from '../../shared/components/domain/bank-actions-bar.component';
import { BuyPropertyPanelComponent } from '../../shared/components/domain/buy-property-panel.component';
import { BuildPanelComponent } from '../../shared/components/domain/build-panel.component';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { ModalComponent } from '../../shared/components/ui/modal.component';
import { MortgagePanelComponent } from '../../shared/components/domain/mortgage-panel.component';
import { RentPanelComponent } from '../../shared/components/domain/rent-panel.component';
import { SkeletonComponent } from '../../shared/components/ui/skeleton.component';
import { TabsComponent } from '../../shared/components/ui/tabs.component';
import { BottomNavComponent } from '../../shared/components/ui/bottom-nav.component';
import { ToastContainerComponent } from '../../shared/components/ui/toast-container.component';
import { ConfirmDialogComponent } from '../../shared/components/ui/confirm-dialog.component';
import { BalanceComponent } from '../../shared/components/ui/balance.component';
import { PlayerDashboardComponent } from '../../shared/components/domain/player-dashboard.component';
import { PropertyRowComponent } from '../../shared/components/domain/property-row.component';
import { PropertyDetailSheetComponent } from '../../shared/components/domain/property-detail-sheet.component';
import { PlayerRowComponent } from '../../shared/components/domain/player-row.component';
import { TradeBuilderComponent } from '../../shared/components/domain/trade-builder.component';
import { TradeListComponent } from '../../shared/components/domain/trade-list.component';
import { TransferPanelComponent } from '../../shared/components/domain/transfer-panel.component';
import { LogFeedComponent } from '../../shared/components/domain/log-feed.component';
import { mapFirebaseError } from '../../core/utils/firebase-errors';
import { ICONS } from '../../shared/icons';
import type {
  PropertyMetadata,
  TradeOffer,
  TradeStatus,
  TransactionLogEntry,
} from '../../core/models';

interface SuccessConfig {
  message: string;
  detail?: string;
  sound: 'transfer' | 'buy' | 'build' | 'cashIn' | 'cashOut' | 'error' | 'salary' | 'notify';
}

type BankActionMeta = 'salary' | 'income-tax' | 'luxury-tax' | 'bankruptcy' | undefined;

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [
    FormsModule,
    ButtonComponent,
    ModalComponent,
    SkeletonComponent,
    TabsComponent,
    BottomNavComponent,
    ToastContainerComponent,
    ConfirmDialogComponent,
    BalanceComponent,
    PlayerDashboardComponent,
    PropertyRowComponent,
    PropertyDetailSheetComponent,
    PlayerRowComponent,
    TradeBuilderComponent,
    TradeListComponent,
    TransferPanelComponent,
    BuyPropertyPanelComponent,
    RentPanelComponent,
    MortgagePanelComponent,
    BuildPanelComponent,
    LogFeedComponent,
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
  private readonly toastService = inject(ToastService);
  protected readonly soundService = inject(SoundService);
  private readonly undoService = inject(UndoService);

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
  readonly confirmBankruptcyOpen = signal(false);
  readonly confirmLeaveOpen = signal(false);
  readonly confirmFinishOpen = signal(false);
  readonly selectedProperty = signal<PropertyMetadata | undefined>(undefined);
  readonly selectedPropertyActions = signal<{
    canMortgage: boolean;
    canUnmortgage: boolean;
    canBuild: boolean;
  }>({ canMortgage: false, canUnmortgage: false, canBuild: false });

  readonly selectedPropertyOwner = computed(() => {
    const property = this.selectedProperty();
    if (!property) return undefined;
    return this.room()?.players.find((p) =>
      p.properties.some((pp) => pp.propertyId === property.id),
    );
  });

  readonly selectedPropertyOwned = computed(() => {
    const property = this.selectedProperty();
    if (!property) return false;
    const owner = this.selectedPropertyOwner();
    return !!owner?.properties.find((pp) => pp.propertyId === property.id);
  });

  readonly propertyRows = computed(() => {
    const properties = this.edition()?.properties;
    const players = this.room()?.players;
    if (!properties || !players) return [];
    return properties.map((property) => {
      const owner = players.find((p) => p.properties.some((pp) => pp.propertyId === property.id));
      const owned = owner?.properties.find((pp) => pp.propertyId === property.id) ?? null;
      return { property, owned, ownerName: owner?.name ?? '' };
    });
  });

  protected readonly icons = ICONS as Record<string, string>;

  readonly pendingTradesForMe = computed(() => {
    const myId = this.auth.userId();
    const trades = this.room()?.trades;
    if (!myId || !trades) return 0;
    return trades.filter((t) => t.status === 'pending' && t.toPlayerId === myId).length;
  });

  readonly tabs = computed(() => [
    { id: 'me', label: 'Yo', icon: ICONS['user'] },
    { id: 'players', label: 'Jugadores', icon: ICONS['users'] },
    { id: 'properties', label: 'Propiedades', icon: ICONS['building'] },
    {
      id: 'trades',
      label: 'Intercambios',
      icon: ICONS['arrow-left-right'],
      badge: this.pendingTradesForMe(),
    },
    { id: 'log', label: 'Historial', icon: ICONS['history'] },
  ]);

  private lastSeenLogId: string | null = null;
  private readonly knownTrades = new Map<string, TradeStatus>();

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

    effect(() => {
      const room = this.room();
      if (!room) {
        this.lastSeenLogId = null;
        return;
      }
      const log = room.log;
      const lastId = log.length ? log[log.length - 1].id : null;
      if (this.lastSeenLogId === null) {
        this.lastSeenLogId = lastId;
        return;
      }
      if (lastId === this.lastSeenLogId) return;

      const seenIndex = log.findIndex((e) => e.id === this.lastSeenLogId);
      const fresh = seenIndex === -1 ? [] : log.slice(seenIndex + 1);
      this.lastSeenLogId = lastId;

      const myId = this.auth.userId() ?? undefined;
      for (const entry of fresh) {
        if (entry.type === 'undo') {
          this.notifyUndoIfNeeded(entry, myId);
        } else {
          this.notifyBankActionIfNeeded(entry, myId);
        }
      }
    });

    effect(() => {
      const room = this.room();
      if (!room) {
        this.knownTrades.clear();
        return;
      }

      const myId = this.auth.userId() ?? undefined;
      for (const trade of room.trades) {
        const known = this.knownTrades.get(trade.id);
        if (!known) {
          this.knownTrades.set(trade.id, trade.status);
          if (trade.status === 'pending' && trade.toPlayerId === myId) {
            this.notifyTradeReceived(trade);
          }
          continue;
        }

        if (known === 'pending' && trade.status !== 'pending') {
          this.knownTrades.set(trade.id, trade.status);
          if (trade.fromPlayerId === myId) {
            this.notifyTradeResolved(trade);
          }
        }
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

  private async runOp(
    op: () => Promise<void>,
    success?: SuccessConfig,
    undoable = false,
  ): Promise<void> {
    this.busy.set(true);
    try {
      await op();
      this.activeAction.set(null);
      if (success) {
        const action = undoable
          ? { label: 'Deshacer', run: () => this.undoLastAction() }
          : undefined;
        this.toastService.success(success.message, success.detail, action);
        this.soundService.play(success.sound);
      }
    } catch (e) {
      const message = mapFirebaseError(e);
      this.toastService.error(message);
      this.soundService.play('error');
    } finally {
      this.busy.set(false);
    }
  }

  private async undoLastAction(): Promise<void> {
    const roomId = this.roomId();
    if (!roomId) return;
    try {
      await this.undoService.undoLast(roomId);
      this.toastService.success('Operación deshecha');
      this.soundService.play('undo');
    } catch (e) {
      const message = mapFirebaseError(e);
      this.toastService.error('No se pudo deshacer', message);
      this.soundService.play('error');
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
    const toName =
      data.toId === 'bank'
        ? 'el Banco'
        : (this.room()?.players.find((p) => p.id === data.toId)?.name ?? 'otro jugador');
    if (!roomId) return;
    this.runOp(
      () => this.bank.transfer(roomId, me, data.toId, data.amount, data.reason),
      {
        message: 'Transferencia realizada',
        detail: `Enviaste ${this.format(data.amount)} a ${toName}`,
        sound: 'transfer',
      },
      true,
    );
  }

  protected onBuy(data: { propertyId: string }): void {
    const roomId = this.roomId();
    const edition = this.edition();
    const me = this.requireCurrentPlayer();
    const propertyName = edition?.properties.find((p) => p.id === data.propertyId)?.name ?? '';
    if (!roomId || !edition) return;
    this.runOp(
      () => this.properties.buyProperty(roomId, edition, me, data.propertyId),
      { message: 'Propiedad comprada', detail: propertyName, sound: 'buy' },
      true,
    );
  }

  protected onRent(data: { toId: string; propertyId: string; amount: number }): void {
    const roomId = this.roomId();
    const room = this.room();
    const me = this.requireCurrentPlayer();
    const owner = room?.players.find((p) => p.id === data.toId);
    const propertyName =
      this.edition()?.properties.find((p) => p.id === data.propertyId)?.name ?? '';
    if (!roomId || !owner) return;
    this.runOp(
      () => this.bank.transfer(roomId, me, owner.id, data.amount, `Alquiler de ${propertyName}`),
      {
        message: 'Renta pagada',
        detail: `${this.format(data.amount)} a ${owner.name}`,
        sound: 'cashOut',
      },
      true,
    );
  }

  protected onMortgage(data: { propertyId: string }): void {
    const roomId = this.roomId();
    const edition = this.edition();
    const me = this.requireCurrentPlayer();
    const propertyName = edition?.properties.find((p) => p.id === data.propertyId)?.name ?? '';
    if (!roomId || !edition) return;
    this.runOp(
      () => this.properties.mortgage(roomId, edition, me, data.propertyId),
      { message: 'Hipoteca creada', detail: propertyName, sound: 'cashIn' },
      true,
    );
  }

  protected onUnmortgage(data: { propertyId: string }): void {
    const roomId = this.roomId();
    const edition = this.edition();
    const me = this.requireCurrentPlayer();
    const propertyName = edition?.properties.find((p) => p.id === data.propertyId)?.name ?? '';
    if (!roomId || !edition) return;
    this.runOp(
      () => this.properties.unmortgage(roomId, edition, me, data.propertyId),
      { message: 'Hipoteca pagada', detail: propertyName, sound: 'cashOut' },
      true,
    );
  }

  protected onBuild(data: {
    propertyId: string;
    mode: 'house' | 'hotel' | 'sell-house' | 'sell-hotel';
  }): void {
    const roomId = this.roomId();
    const edition = this.edition();
    const me = this.requireCurrentPlayer();
    const propertyName = edition?.properties.find((p) => p.id === data.propertyId)?.name ?? '';
    if (!roomId || !edition) return;
    this.runOp(
      async () => {
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
      },
      {
        message: data.mode.startsWith('sell') ? 'Edificio vendido' : 'Construcción realizada',
        detail: propertyName,
        sound: 'build',
      },
      true,
    );
  }

  protected onBankSalary(): void {
    const roomId = this.roomId();
    const edition = this.edition();
    const me = this.requireCurrentPlayer();
    if (!roomId || !edition) return;
    this.runOp(
      () =>
        this.bank.payFromBank(roomId, me, edition.goSalary, 'Sueldo por salida', {
          bankAction: 'salary',
        }),
      { message: 'Sueldo cobrado', detail: this.format(edition.goSalary), sound: 'salary' },
      true,
    );
  }

  protected onBankTax(type: 'income' | 'luxury'): void {
    const roomId = this.roomId();
    const edition = this.edition();
    const me = this.requireCurrentPlayer();
    if (!roomId || !edition) return;
    const amount = type === 'income' ? edition.incomeTax : edition.luxuryTax;
    const name = type === 'income' ? 'Impuesto sobre la renta' : 'Impuesto de lujo';
    const bankAction: BankActionMeta = type === 'income' ? 'income-tax' : 'luxury-tax';
    this.runOp(
      () => this.bank.payTax(roomId, me, amount, name, { bankAction }),
      { message: 'Impuesto pagado', detail: `${name}: ${this.format(amount)}`, sound: 'cashOut' },
      true,
    );
  }

  protected promptBankruptcy(): void {
    this.confirmBankruptcyOpen.set(true);
  }

  protected onBankruptcyConfirmed(confirmed: boolean): void {
    this.confirmBankruptcyOpen.set(false);
    if (!confirmed) return;
    const roomId = this.roomId();
    const me = this.requireCurrentPlayer();
    if (!roomId) return;
    this.runOp(() => this.bank.declareBankruptcy(roomId, me), {
      message: 'Bancarrota declarada',
      detail: 'Estás fuera de la partida',
      sound: 'error',
    });
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
    const toName = this.room()?.players.find((p) => p.id === data.toId)?.name ?? '';
    if (!roomId) return;
    this.runOp(
      () =>
        this.tradeService.create(
          roomId,
          me,
          data.toId,
          { cash: data.fromCash, propertyIds: data.fromProperties },
          { cash: data.toCash, propertyIds: data.toProperties },
        ),
      { message: 'Intercambio propuesto', detail: `Oferta enviada a ${toName}`, sound: 'transfer' },
    );
  }

  protected acceptTrade(offerId: string): void {
    const roomId = this.roomId();
    if (!roomId) return;
    this.runOp(() => this.tradeService.accept(roomId, offerId), {
      message: 'Intercambio aceptado',
      detail: 'La propiedad y dinero se han transferido',
      sound: 'transfer',
    });
  }

  protected rejectTrade(offerId: string): void {
    const roomId = this.roomId();
    if (!roomId) return;
    this.runOp(() => this.tradeService.reject(roomId, offerId));
  }

  protected promptFinishGame(): void {
    this.confirmFinishOpen.set(true);
  }

  protected async onFinishConfirmed(confirmed: boolean): Promise<void> {
    this.confirmFinishOpen.set(false);
    if (!confirmed) return;
    const roomId = this.roomId();
    if (!roomId) return;
    try {
      await this.roomService.finishGame(roomId, 'manual');
      this.router.navigate(['/history', roomId]);
    } catch (e) {
      this.toastService.error(mapFirebaseError(e));
      this.soundService.play('error');
    }
  }

  protected promptLeave(): void {
    this.confirmLeaveOpen.set(true);
  }

  protected async onLeaveConfirmed(confirmed: boolean): Promise<void> {
    this.confirmLeaveOpen.set(false);
    if (!confirmed) return;
    const roomId = this.roomId();
    const me = this.requireCurrentPlayer();
    if (!roomId) return;
    try {
      await this.roomService.leaveRoom(roomId, me);
      this.gameState.unsubscribe();
      this.router.navigate(['/']);
    } catch (e) {
      this.toastService.error(mapFirebaseError(e));
      this.soundService.play('error');
    }
  }

  protected async joinGame(): Promise<void> {
    const roomId = this.roomId();
    const name = this.joinName().trim();
    if (!roomId || !name) return;
    this.joining.set(true);
    try {
      await this.roomService.joinRoom(roomId, name);
    } catch (e) {
      this.toastService.error(mapFirebaseError(e));
      this.soundService.play('error');
    } finally {
      this.joining.set(false);
    }
  }

  protected openPropertyDetail(property: PropertyMetadata): void {
    const me = this.currentPlayer();
    const owned = me?.properties.find((pp) => pp.propertyId === property.id);
    this.selectedProperty.set(property);
    this.selectedPropertyActions.set({
      canMortgage: !!owned && !owned.mortgaged && owned.houses === 0 && !owned.hasHotel,
      canUnmortgage: !!owned && owned.mortgaged,
      canBuild: !!owned && !owned.mortgaged && !property.isRailroad && !property.isUtility,
    });
  }

  protected closePropertyDetail(): void {
    this.selectedProperty.set(undefined);
  }

  protected onPropertyAction(actionId: string): void {
    const property = this.selectedProperty();
    if (!property) return;
    this.closePropertyDetail();
    switch (actionId) {
      case 'buy':
        this.onBuy({ propertyId: property.id });
        break;
      case 'mortgage':
        this.activeAction.set('mortgage');
        break;
      case 'unmortgage':
        this.activeAction.set('unmortgage');
        break;
      case 'build':
        this.activeAction.set('build');
        break;
    }
  }

  private notifyUndoIfNeeded(entry: TransactionLogEntry, myId?: string): void {
    const undoneBy = entry.metadata?.['undoneBy'] as string | undefined;
    if (!undoneBy || undoneBy === myId) return;

    this.toastService.info(`${this.playerName(undoneBy)} deshizo una acción`, entry.description);
    this.soundService.play('notify');
  }

  private playerName(playerId?: string | 'bank'): string {
    if (playerId === undefined || playerId === 'bank') return 'Alguien';
    return this.room()?.players.find((p) => p.id === playerId)?.name ?? 'Alguien';
  }

  private notifyBankActionIfNeeded(entry: TransactionLogEntry, myId?: string): void {
    const action = (entry.metadata?.['bankAction'] as BankActionMeta) ?? undefined;
    if (!action) return;

    const actorId = action === 'salary' ? entry.toPlayerId : entry.fromPlayerId;
    if (actorId === myId) return;

    switch (action) {
      case 'salary': {
        this.toastService.info(
          `${this.playerName(actorId)} cobró el sueldo`,
          this.format(entry.amount),
        );
        this.soundService.play('notify');
        break;
      }
      case 'income-tax':
      case 'luxury-tax': {
        const taxLabel = action === 'income-tax' ? 'Impuesto sobre la renta' : 'Impuesto de lujo';
        this.toastService.info(
          `${this.playerName(actorId)} pagó ${taxLabel.toLowerCase()}`,
          `-${this.format(entry.amount)}`,
        );
        this.soundService.play('notify');
        break;
      }
      case 'bankruptcy': {
        this.toastService.info(
          `${this.playerName(actorId)} se declaró en quiebra`,
          'Queda fuera de la partida',
        );
        this.soundService.play('notify');
        break;
      }
    }
  }

  private format(amount: number): string {
    const currency = this.edition()?.currency;
    if (!currency) return `${amount}`;
    const symbol = currency.symbol;
    return `${symbol}${amount.toLocaleString('es-ES')}`;
  }

  private notifyTradeReceived(offer: TradeOffer): void {
    const fromName = this.playerName(offer.fromPlayerId);
    const fromItems = this.tradeItemsSummary(offer.fromItems);
    const toItems = this.tradeItemsSummary(offer.toItems);
    const detail = `Te ofrece ${fromItems} · Pide ${toItems}`;

    this.toastService.show('info', `${fromName} te propuso un intercambio`, detail, 10000, {
      label: 'Ver',
      run: () => this.activeTab.set('trades'),
    });
    this.soundService.play('notify');
  }

  private notifyTradeResolved(offer: TradeOffer): void {
    const toName = this.playerName(offer.toPlayerId);
    const detail = this.tradeItemsSummary(offer.fromItems);

    if (offer.status === 'accepted') {
      this.toastService.success(`${toName} aceptó tu intercambio`, detail);
      this.soundService.play('success');
    } else {
      this.toastService.info(`${toName} rechazó tu intercambio`, detail);
      this.soundService.play('notify');
    }
  }

  private tradeItemsSummary(items: { cash: number; propertyIds: string[] }): string {
    const edition = this.edition();
    const cashText = items.cash > 0 ? this.format(items.cash) : '';
    const propertyNames = items.propertyIds
      .map((id) => edition?.properties.find((p) => p.id === id)?.name)
      .filter(Boolean)
      .join(', ');

    if (cashText && propertyNames) {
      return `${cashText} + ${propertyNames}`;
    }
    if (cashText) return cashText;
    if (propertyNames) return propertyNames;
    return '—';
  }

  protected toggleSound(): void {
    this.soundService.toggle();
  }
}
