import { Component, computed, inject, input, linkedSignal, model, output, signal } from '@angular/core';
import type { CurrencyConfig, Edition, Player } from '../../../core/models';
import { AmountInputComponent } from '../ui/amount-input.component';
import { PlayerAvatarComponent } from '../ui/player-avatar.component';
import { WizardComponent } from '../ui/wizard.component';
import { MoneyFormatService } from '../../../core/services/money-format.service';
import { ICONS } from '../../icons';

export type BankPayStep = 'to' | 'amount' | 'confirm';

@Component({
  selector: 'app-bank-pay-panel',
  imports: [AmountInputComponent, PlayerAvatarComponent, WizardComponent],
  templateUrl: './bank-pay-panel.component.html',
})
export class BankPayPanelComponent {
  protected readonly formatter = inject(MoneyFormatService);

  readonly players = input.required<Player[]>();
  readonly currency = input.required<CurrencyConfig>();
  readonly edition = input.required<Edition>();
  readonly me = input.required<Player>();
  readonly isHost = input.required<boolean>();
  readonly amount = model(0);
  readonly reason = model('');
  readonly payAction = output<{ toId: string; amount: number; reason: string }>();

  protected readonly icons = ICONS as Record<string, string>;
  protected readonly toId = signal<string | undefined>(undefined);

  /** The host chooses who gets paid; everyone else can only receive money themselves. */
  protected readonly flow = computed<BankPayStep[]>(() =>
    this.isHost() ? ['to', 'amount', 'confirm'] : ['amount', 'confirm'],
  );
  protected readonly stepLabels = computed(() =>
    this.flow().map((s) => (s === 'to' ? 'Jugador' : s === 'amount' ? 'Cantidad' : 'Confirmar')),
  );
  protected readonly step = linkedSignal<BankPayStep>(() => this.flow()[0]);
  protected readonly stepIndex = computed(() => Math.max(0, this.flow().indexOf(this.step())));

  protected eligibleTo = computed(() =>
    this.players().filter((p) => !p.bankrupt),
  );

  protected amountChips = computed(() => {
    const edition = this.edition();
    const values = [edition.goSalary, edition.jailFine, edition.incomeTax, edition.luxuryTax].filter(
      (v): v is number => typeof v === 'number' && v > 0,
    );
    const unique = Array.from(new Set(values));
    return unique.sort((a, b) => b - a).slice(0, 4);
  });

  protected recipient = computed(() => {
    if (!this.isHost()) return this.me();
    const id = this.toId();
    if (!id) return undefined;
    return this.players().find((p) => p.id === id);
  });

  protected finalBalance = computed(() => {
    const player = this.recipient();
    if (!player) return this.amount();
    return player.cash + this.amount();
  });

  protected canSubmit = computed(() => this.amount() > 0 && !!this.recipient());

  protected readonly title = computed(() => {
    switch (this.step()) {
      case 'to':
        return '¿A quién le pagas?';
      case 'amount':
        return this.isHost() ? `¿Cuánto recibe ${this.recipient()?.name ?? ''}?` : '¿Cuánto recibes del Banco?';
      case 'confirm':
        return this.isHost() ? 'Confirma el pago' : 'Confirma el cobro';
    }
  });

  protected readonly hint = computed(() => {
    switch (this.step()) {
      case 'to':
        return 'El Banco le entrega el dinero al jugador que elijas.';
      case 'amount':
        return 'Usa un atajo de la edición o escribe la cantidad.';
      case 'confirm':
        return 'Revisa los datos antes de continuar.';
    }
  });

  protected readonly primaryLabel = computed(() => {
    if (this.step() === 'amount') return 'Revisar';
    return this.isHost() ? 'Enviar dinero' : 'Recibir dinero';
  });

  protected readonly primaryDisabled = computed(() => !this.canSubmit() && this.step() !== 'to');

  protected goTo(step: BankPayStep): void {
    this.step.set(step);
  }

  protected back(): void {
    const previous = this.flow()[this.stepIndex() - 1];
    if (previous) this.step.set(previous);
  }

  protected advance(): void {
    if (this.step() === 'confirm') {
      this.submit();
      return;
    }
    const next = this.flow()[this.stepIndex() + 1];
    if (next) this.step.set(next);
  }

  protected onReasonInput(value: string): void {
    this.reason.set(value);
  }

  protected selectTo(id: string): void {
    this.toId.set(id);
    this.advance();
  }

  protected toggleAmountChip(value: number): void {
    if (this.amount() === value) {
      this.amount.set(0);
    } else {
      this.amount.set(value);
    }
  }

  submit(): void {
    const to = this.recipient();
    if (!to || this.amount() <= 0) return;
    this.payAction.emit({
      toId: to.id,
      amount: this.amount(),
      reason: this.reason() || 'Pago del Banco',
    });
  }
}
