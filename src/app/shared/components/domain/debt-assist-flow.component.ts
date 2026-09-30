import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ModalComponent } from '../../components/ui/modal.component';
import { ConfirmDialogComponent } from '../../components/ui/confirm-dialog.component';
import { DebtAssistDialogComponent } from './debt-assist-dialog.component';
import type { Edition, Player } from '../../../core/models';
import { DebtAssistanceService, type DebtPayment } from '../../../core/services/debt-assistance.service';
import { LiquidationService } from '../../../core/services/liquidation.service';
import { BankService, type BankruptcyCreditor } from '../../../core/services/bank.service';
import { ToastService } from '../../../core/services/toast.service';
import { SoundService } from '../../../core/services/sound.service';
import { MoneyFormatService } from '../../../core/services/money-format.service';
import type { SoundName } from '../../../core/services/sound.service';
import { mapFirebaseError } from '../../../core/utils/firebase-errors';

@Component({
  selector: 'app-debt-assist-flow',
  imports: [ModalComponent, ConfirmDialogComponent, DebtAssistDialogComponent],
  template: `
    <app-modal
      [open]="open()"
      title="Deuda asistida"
      size="lg"
      [flushBottom]="true"
      [closeable]="!busy()"
      (closeAction)="onClose()"
    >
      <app-debt-assist-dialog
        [open]="open()"
        [me]="me()"
        [edition]="edition()"
        [currency]="edition().currency"
        [payment]="payment()"
        [busy]="busy()"
        (applyAction)="onApply($event)"
        (bankruptcyAction)="onBankruptcyRequest()"
        (closeAction)="onClose()"
      />
    </app-modal>

    <app-confirm-dialog
      [open]="confirmOpen()"
      title="¿Declarar bancarrota?"
      [message]="confirmMessage()"
      confirmLabel="Declarar bancarrota"
      confirmVariant="danger"
      (confirmed)="onConfirmBankruptcy($event)"
    />
  `,
})
export class DebtAssistFlowComponent {
  private readonly debtAssistance = inject(DebtAssistanceService);
  private readonly liquidation = inject(LiquidationService);
  private readonly bank = inject(BankService);
  private readonly toastService = inject(ToastService);
  private readonly soundService = inject(SoundService);
  private readonly moneyFormatter = inject(MoneyFormatService);

  readonly open = input.required<boolean>();
  readonly roomId = input.required<string>();
  readonly me = input.required<Player>();
  readonly edition = input.required<Edition>();
  readonly players = input.required<Player[]>();
  /** Si no se proporciona, el flujo opera en modo recuperación (sin pago pendiente). */
  readonly payment = input<DebtPayment | undefined>(undefined);

  readonly closeAction = output<void>();
  readonly completed = output<void>();

  readonly busy = signal(false);
  readonly confirmOpen = signal(false);
  readonly pendingBankruptcy = signal<{
    mode: 'debt' | 'recovery';
    creditors: BankruptcyCreditor[];
    totalAvailable: number;
  } | null>(null);

  readonly confirmMessage = computed(() => {
    const pending = this.pendingBankruptcy();
    if (!pending || pending.mode === 'recovery') {
      return 'Esta acción no se puede deshacer. Tus propiedades regresarán al Banco quedando libres de hipotecas y construcciones, y saldrás de la partida.';
    }

    const currency = this.edition().currency;
    const amountText = this.format(pending.totalAvailable);
    const names = pending.creditors
      .map((c) => this.playerName(c.playerId))
      .filter(Boolean);

    if (names.length === 0) {
      return 'Se liquidarán todos tus activos y el efectivo recaudado se perderá. Quedarás en bancarrota.';
    }

    const creditorText = names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' y ' + names.at(-1);
    return `Se liquidarán todos tus activos y se entregarán ${amountText} a ${creditorText}, aunque no cubran la deuda. Quedarás en bancarrota.`;
  });

  protected onApply(actionIds: string[]): void {
    const payment = this.payment();
    if (payment) {
      this.runOp(
        () => this.debtAssistance.applyPlanAndPay(this.roomId(), this.edition(), this.me().id, actionIds, payment),
        { message: 'Pago completado', detail: payment.label, sound: 'cashOut' },
      );
      return;
    }

    this.runOp(async () => {
      const result = await this.liquidation.executeActions(this.roomId(), this.edition(), this.me().id, actionIds);
      const detail = `+${this.format(result.totalCash)} en efectivo`;
      this.toastService.success('Activos liquidados', detail);
      this.soundService.play('cashIn');
    });
  }

  protected onBankruptcyRequest(): void {
    const payment = this.payment();
    const creditors: BankruptcyCreditor[] = payment ? this.buildCreditors(payment) : [];
    const plan = this.liquidation.plan(this.me(), this.edition());
    const totalAvailable = this.me().cash + plan.totalCash;

    this.pendingBankruptcy.set({
      mode: payment ? 'debt' : 'recovery',
      creditors,
      totalAvailable,
    });
    this.confirmOpen.set(true);
  }

  protected onConfirmBankruptcy(confirmed: boolean): void {
    this.confirmOpen.set(false);
    if (!confirmed) return;

    const pending = this.pendingBankruptcy();
    if (!pending) return;

    const roomId = this.roomId();
    const playerId = this.me().id;
    const settlement = pending.creditors.length > 0
      ? { edition: this.edition(), creditors: pending.creditors }
      : undefined;

    this.runOp(async () => {
      await this.bank.declareBankruptcy(roomId, playerId, settlement);
      const detail = this.buildBankruptcyDetail(pending.creditors, pending.totalAvailable);
      this.toastService.success('Bancarrota declarada', detail);
      this.soundService.play('error');
    });
  }

  protected onClose(): void {
    this.reset();
    this.closeAction.emit();
  }

  private reset(): void {
    this.pendingBankruptcy.set(null);
    this.confirmOpen.set(false);
  }

  private buildCreditors(payment: DebtPayment): BankruptcyCreditor[] {
    if (payment.toId && payment.toId !== 'bank') {
      return [{ playerId: payment.toId, owed: payment.amount }];
    }

    if (payment.toIds?.length) {
      const perPlayer = payment.amountPerPlayer ?? Math.floor(payment.amount / payment.toIds.length);
      return payment.toIds
        .filter((id): id is string => id !== 'bank')
        .map((playerId) => ({ playerId, owed: perPlayer }));
    }

    return [];
  }

  private buildBankruptcyDetail(creditors: BankruptcyCreditor[], totalAvailable: number): string {
    if (creditors.length === 0) {
      return 'Estás fuera de la partida';
    }
    const names = creditors
      .map((c) => this.playerName(c.playerId))
      .filter(Boolean);
    const amountText = this.format(Math.min(totalAvailable, creditors.reduce((sum, c) => sum + c.owed, 0)));
    if (names.length === 1) {
      return `${names[0]} recibió ${amountText}`;
    }
    return `Los acreedores recibieron ${amountText}`;
  }

  private playerName(playerId: string): string | undefined {
    if (playerId === this.me().id) return this.me().name;
    return this.players().find((p) => p.id === playerId)?.name;
  }

  private format(amount: number): string {
    return this.moneyFormatter.format(amount, this.edition().currency);
  }

  private async runOp(op: () => Promise<void>, success?: { message: string; detail: string; sound: SoundName }): Promise<void> {
    this.busy.set(true);
    try {
      await op();
      if (success) {
        this.toastService.success(success.message, success.detail);
        this.soundService.play(success.sound);
      }
      this.reset();
      this.completed.emit();
    } catch (e) {
      this.toastService.error(mapFirebaseError(e));
      this.soundService.play('error');
    } finally {
      this.busy.set(false);
    }
  }
}
