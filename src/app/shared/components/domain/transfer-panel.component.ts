import { Component, computed, inject, input, model, output, signal } from '@angular/core';
import type { CurrencyConfig, Edition, Player } from '../../../core/models';
import { AmountInputComponent } from '../ui/amount-input.component';
import { PlayerAvatarComponent } from '../ui/player-avatar.component';
import { WizardComponent } from '../ui/wizard.component';
import { MoneyFormatService } from '../../../core/services/money-format.service';
import { ICONS } from '../../icons';

export interface TransferAction {
  toIds: Array<string | 'bank'>;
  amountPerPlayer: number;
  reason: string;
}

export type TransferStep = 'to' | 'amount' | 'confirm';

const STEPS: readonly TransferStep[] = ['to', 'amount', 'confirm'];

interface Recipient {
  id: string;
  name: string;
  avatarColor: string;
}

@Component({
  selector: 'app-transfer-panel',
  imports: [AmountInputComponent, PlayerAvatarComponent, WizardComponent],
  templateUrl: './transfer-panel.component.html',
})
export class TransferPanelComponent {
  protected readonly formatter = inject(MoneyFormatService);

  readonly me = input.required<Player>();
  readonly players = input.required<Player[]>();
  readonly currency = input.required<CurrencyConfig>();
  readonly edition = input<Edition | undefined>(undefined);
  readonly amount = model(0);
  readonly reason = model('');
  readonly transferAction = output<TransferAction>();

  protected readonly icons = ICONS as Record<string, string>;
  protected readonly stepLabels = ['Para quién', 'Cuánto', 'Enviar'];
  protected readonly step = signal<TransferStep>('to');
  protected readonly selectedIds = signal<Set<string>>(new Set());

  protected readonly stepIndex = computed(() => STEPS.indexOf(this.step()));

  protected eligiblePlayers = computed(() =>
    this.players().filter((p) => p.id !== this.me().id && !p.bankrupt),
  );

  protected hasEligiblePlayers = computed(() => this.eligiblePlayers().length > 0);

  protected bankOption = computed<Recipient>(() => ({
    id: 'bank',
    name: 'Banco',
    avatarColor: 'bg-slate-500',
  }));

  protected selectedCount = computed(() => this.selectedIds().size);

  /** Everything that can be picked in the first step: the bank first, then the other players. */
  protected targets = computed<Recipient[]>(() => [
    this.bankOption(),
    ...this.eligiblePlayers().map((p) => ({ id: p.id, name: p.name, avatarColor: p.avatarColor })),
  ]);

  protected recipientsLabel = computed(() => {
    const names = this.recipients().map((r) => r.name);
    if (names.length <= 3) return names.join(', ');
    return `${names.length} destinatarios`;
  });

  protected playerCash(id: string): string {
    const player = this.players().find((p) => p.id === id);
    return player ? this.formatter.format(player.cash, this.currency()) : '';
  }

  protected selectedPlayerCount = computed(() =>
    [...this.selectedIds()].filter((id) => id !== 'bank').length,
  );

  /** Chosen recipients in a stable order: Banco first, then players. */
  protected recipients = computed<Recipient[]>(() => {
    const ids = this.selectedIds();
    const list: Recipient[] = [];
    if (ids.has('bank')) list.push(this.bankOption());
    for (const p of this.eligiblePlayers()) {
      if (ids.has(p.id)) list.push({ id: p.id, name: p.name, avatarColor: p.avatarColor });
    }
    return list;
  });

  protected allPlayersSelected = computed(() => {
    const eligible = this.eligiblePlayers();
    if (eligible.length === 0) return false;
    return eligible.every((p) => this.selectedIds().has(p.id));
  });

  protected total = computed(() => this.amount() * this.selectedCount());

  /** Largest per-recipient amount the player can afford, so the input can flag overspending. */
  protected maxPerRecipient = computed(() =>
    Math.floor(this.me().cash / Math.max(1, this.selectedCount())),
  );

  protected remaining = computed(() => Math.max(0, this.me().cash - this.total()));

  protected insufficient = computed(
    () => this.amount() > 0 && this.selectedCount() > 0 && this.me().cash < this.total(),
  );

  protected canSubmit = computed(
    () => this.amount() > 0 && this.selectedCount() > 0 && this.me().cash >= this.total(),
  );

  protected readonly title = computed(() => {
    switch (this.step()) {
      case 'to':
        return '¿A quién le envías dinero?';
      case 'amount':
        return this.selectedCount() > 1 ? '¿Cuánto le das a cada uno?' : '¿Cuánto envías?';
      case 'confirm':
        return 'Confirma la transferencia';
    }
  });

  protected readonly hint = computed(() => {
    switch (this.step()) {
      case 'to':
        return 'Puedes elegir uno, varios o a todos los jugadores.';
      case 'amount':
        return this.selectedCount() > 1
          ? 'Cada destinatario recibirá esta cantidad.'
          : 'Escribe la cantidad y, si quieres, un motivo.';
      case 'confirm':
        return 'Revisa los datos antes de enviar.';
    }
  });

  protected readonly primaryLabel = computed(() => {
    switch (this.step()) {
      case 'to':
        return 'Siguiente';
      case 'amount':
        return 'Revisar';
      case 'confirm':
        return this.total() > 0
          ? `Transferir ${this.formatter.format(this.total(), this.currency())}`
          : 'Transferir';
    }
  });

  protected readonly primaryDisabled = computed(() => {
    switch (this.step()) {
      case 'to':
        return this.selectedCount() === 0;
      case 'amount':
        return this.amount() <= 0 || this.insufficient();
      case 'confirm':
        return !this.canSubmit();
    }
  });

  protected goTo(step: TransferStep): void {
    this.step.set(step);
  }

  protected back(): void {
    const previous = STEPS[this.stepIndex() - 1];
    if (previous) this.step.set(previous);
  }

  protected advance(): void {
    if (this.step() === 'confirm') {
      this.submit();
      return;
    }
    const next = STEPS[this.stepIndex() + 1];
    if (next) this.step.set(next);
  }

  protected toggleRecipient(id: string | 'bank'): void {
    this.selectedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected toggleSelectAllPlayers(): void {
    const eligible = this.eligiblePlayers();
    if (eligible.length === 0) return;

    const everyoneSelected = this.allPlayersSelected();
    this.selectedIds.update((set) => {
      const next = new Set(set);
      for (const p of eligible) {
        if (everyoneSelected) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });
  }

  protected onReasonInput(value: string): void {
    this.reason.set(value);
  }

  protected submit(): void {
    const toIds = [...this.selectedIds()].filter(
      (id) => id === 'bank' || this.players().some((p) => p.id === id && !p.bankrupt),
    );
    if (toIds.length === 0 || this.amount() <= 0) return;

    this.transferAction.emit({
      toIds,
      amountPerPlayer: this.amount(),
      reason: this.reason() || 'Transferencia',
    });
  }
}
