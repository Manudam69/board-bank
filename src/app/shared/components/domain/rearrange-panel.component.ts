import { Component, computed, effect, input, output, signal } from '@angular/core';
import type { CurrencyConfig } from '../../../core/models';
import type { GroupBuildingState } from '../../../core/services/building-rules.service';
import { ButtonComponent } from '../../components/ui/button.component';

@Component({
  selector: 'app-rearrange-panel',
  imports: [ButtonComponent],
  templateUrl: './rearrange-panel.component.html',
})
export class RearrangePanelComponent {
  readonly group = input.required<GroupBuildingState>();
  readonly currency = input.required<CurrencyConfig>();
  readonly busy = input(false);

  readonly applyAction = output<Record<string, number>>();
  readonly cancelAction = output<void>();

  protected readonly draft = computed(() => {
    const record: Record<string, number> = {};
    for (const p of this.group().properties) {
      record[p.meta.id] = p.owned?.houses ?? 0;
    }
    return record;
  });

  protected readonly draftState = signal<Record<string, number>>({});
  protected readonly sourceId = signal<string | null>(null);

  protected readonly sourceName = computed(() => {
    const id = this.sourceId();
    if (!id) return '';
    return this.group().properties.find((p) => p.meta.id === id)?.meta.name ?? '';
  });

  constructor() {
    // Inicializar el borrador cuando cambia el grupo
    effect(() => {
      this.draftState.set({ ...this.draft() });
      this.sourceId.set(null);
    });
  }

  protected readonly beforeDistribution = computed(() =>
    this.group().properties.map((p) => (p.owned?.hasHotel ? 'H' : (p.owned?.houses ?? 0))),
  );

  protected readonly afterDistribution = computed(() => {
    const state = this.draftState();
    return this.group().properties.map((p) => (p.owned?.hasHotel ? 'H' : (state[p.meta.id] ?? 0)));
  });

  protected readonly afterLevels = computed(() => {
    return this.group().properties.map((p) => (p.owned?.hasHotel ? 5 : (this.draftState()[p.meta.id] ?? 0)));
  });

  protected readonly totalOriginal = computed(() => this.group().properties.reduce((sum, p) => sum + (p.owned?.houses ?? 0), 0),
  );

  protected readonly totalDraft = computed(() =>
    Object.values(this.draftState()).reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0),
  );

  protected readonly validation = computed(() => {
    const state = this.draftState();
    const props = this.group().properties;

    for (const p of props) {
      const v = state[p.meta.id];
      if (v === undefined) return { valid: false, reason: 'Distribución incompleta' };
      if (!Number.isInteger(v) || v < 0 || v > 4) {
        return { valid: false, reason: `${p.meta.name}: solo se permiten entre 0 y 4 casas` };
      }
      if (p.owned?.hasHotel) {
        return { valid: false, reason: `${p.meta.name}: no se pueden reorganizar hoteles` };
      }
    }

    if (this.totalDraft() !== this.totalOriginal()) {
      return {
        valid: false,
        reason: `La reorganización debe conservar las ${this.totalOriginal()} casas (tienes ${this.totalDraft()})`,
      };
    }

    const levels = this.afterLevels();
    const min = Math.min(...levels);
    const max = Math.max(...levels);
    if (max - min > 1) {
      return { valid: false, reason: 'La nueva distribución rompe la construcción uniforme' };
    }

    const hasChanged = props.some((p) => (p.owned?.houses ?? 0) !== state[p.meta.id]);
    if (!hasChanged) {
      return { valid: false, reason: 'La distribución no ha cambiado' };
    }

    return { valid: true, reason: undefined };
  });

  protected readonly canApply = computed(() => this.validation().valid);

  protected isValidDestination(propertyId: string): boolean {
    if (!this.sourceId()) return false;
    if (this.sourceId() === propertyId) return false;
    const next = { ...this.draftState() };
    next[this.sourceId()!]--;
    next[propertyId]++;
    const props = this.group().properties;
    const levels = props.map((p) => (p.owned?.hasHotel ? 5 : next[p.meta.id]));
    return Math.max(...levels) - Math.min(...levels) <= 1;
  }

  protected onPropertyClick(propertyId: string): void {
    const props = this.group().properties;
    const prop = props.find((p) => p.meta.id === propertyId);
    if (!prop?.owned || prop.owned.hasHotel) return;

    const source = this.sourceId();
    if (!source) {
      if ((this.draftState()[propertyId] ?? 0) <= 0) return;
      this.sourceId.set(propertyId);
      return;
    }

    if (source === propertyId) {
      this.sourceId.set(null);
      return;
    }

    if (!this.isValidDestination(propertyId)) return;

    this.draftState.update((draft) => {
      const next = { ...draft };
      next[source] = (next[source] ?? 0) - 1;
      next[propertyId] = (next[propertyId] ?? 0) + 1;
      return next;
    });
    this.sourceId.set(null);
  }

  protected reset(): void {
    this.draftState.set({ ...this.draft() });
    this.sourceId.set(null);
  }

  protected apply(): void {
    if (!this.canApply()) return;
    this.applyAction.emit({ ...this.draftState() });
  }

  protected cancel(): void {
    this.cancelAction.emit();
  }

  protected stepper(propertyId: string, delta: number): void {
    this.draftState.update((draft) => {
      const next = { ...draft };
      next[propertyId] = Math.max(0, Math.min(4, (next[propertyId] ?? 0) + delta));
      return next;
    });
    this.sourceId.set(null);
  }
}
