import { Component, computed, inject, input, model, output, signal } from '@angular/core';
import type { CurrencyConfig, Edition, Player } from '../../../core/models';
import { AmountInputComponent } from '../ui/amount-input.component';
import { ButtonComponent } from '../ui/button.component';
import { MoneyFormatService } from '../../../core/services/money-format.service';
import { ICONS } from '../../icons';

export interface TransferAction {
  toIds: Array<string | 'bank'>;
  amountPerPlayer: number;
  reason: string;
}

@Component({
  selector: 'app-transfer-panel',
  imports: [AmountInputComponent, ButtonComponent],
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

  protected readonly icons = ICONS;
  protected readonly selectedIds = signal<Set<string>>(new Set());

  protected eligiblePlayers = computed(() =>
    this.players().filter((p) => p.id !== this.me().id && !p.bankrupt),
  );

  protected hasEligiblePlayers = computed(() => this.eligiblePlayers().length > 0);

  protected bankOption = computed(() => ({
    id: 'bank' as const,
    name: 'Banco',
    avatarColor: '#64748b',
  }));

  protected selectedCount = computed(() => this.selectedIds().size);

  protected selectedPlayerCount = computed(() =>
    [...this.selectedIds()].filter((id) => id !== 'bank').length,
  );

  protected allPlayersSelected = computed(() => {
    const eligible = this.eligiblePlayers();
    if (eligible.length === 0) return false;
    return eligible.every((p) => this.selectedIds().has(p.id));
  });

  protected total = computed(() => this.amount() * this.selectedCount());

  protected remaining = computed(() => Math.max(0, this.me().cash - this.total()));

  protected insufficient = computed(
    () => this.amount() > 0 && this.selectedCount() > 0 && this.me().cash < this.total(),
  );

  protected canSubmit = computed(
    () => this.amount() > 0 && this.selectedCount() > 0 && this.me().cash >= this.total(),
  );

  protected destinationSummary = computed(() => {
    const count = this.selectedCount();
    if (count === 0) return { label: 'Destinatarios', detail: '' };

    const names: string[] = [];
    if (this.selectedIds().has('bank')) names.push('Banco');
    for (const p of this.eligiblePlayers()) {
      if (this.selectedIds().has(p.id)) names.push(p.name);
    }

    if (count === 1) return { label: names[0], detail: '' };
    const joined = names.slice(0, 3).join(', ');
    const extra = names.length > 3 ? ` +${names.length - 3}` : '';
    return { label: `${count} destinatarios`, detail: `${joined}${extra}` };
  });

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

    if (this.allPlayersSelected()) {
      this.selectedIds.update((set) => {
        const next = new Set(set);
        for (const p of eligible) next.delete(p.id);
        return next;
      });
    } else {
      this.selectedIds.update((set) => {
        const next = new Set(set);
        for (const p of eligible) next.add(p.id);
        return next;
      });
    }
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
    this.amount.set(0);
    this.reason.set('');
    this.selectedIds.set(new Set());
  }
}
