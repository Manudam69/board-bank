import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EditionService } from '../../core/services/edition.service';
import { MoneyFormatService } from '../../core/services/money-format.service';
import { IdService } from '../../core/services/id.service';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { ModalComponent } from '../../shared/components/ui/modal.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import type { CurrencyConfig, Edition, PropertyMetadata } from '../../core/models';

@Component({
  selector: 'app-editions',
  standalone: true,
  imports: [FormsModule, ButtonComponent, ModalComponent, MoneyPipe],
  templateUrl: './editions.component.html',
})
export class EditionsComponent {
  protected readonly router = inject(Router);
  private readonly editionService = inject(EditionService);
  private readonly formatter = inject(MoneyFormatService);
  private readonly id = inject(IdService);

  readonly editions = computed(() => this.editionService.editions());

  readonly showEditor = signal(false);
  readonly editingId = signal<string | undefined>(undefined);
  readonly name = signal('');
  readonly description = signal('');
  readonly symbol = signal('€');
  readonly scale = signal<CurrencyConfig['scale']>('units');
  readonly startingMoney = signal(1500);
  readonly goSalary = signal(200);
  readonly jailFine = signal(50);
  readonly incomeTax = signal(200);
  readonly luxuryTax = signal(100);
  readonly properties = signal<PropertyMetadata[]>([]);
  readonly saving = signal(false);
  readonly error = signal('');

  protected newProperty(): PropertyMetadata {
    return {
      id: this.id.newId(),
      name: '',
      group: '',
      groupColor: '#3B82F6',
      order: this.properties().length + 1,
      price: 0,
      mortgageValue: 0,
      houseCost: 0,
      hotelCost: 0,
      rents: [0, 0, 0, 0, 0, 0],
    };
  }

  protected openNew(): void {
    this.editingId.set(undefined);
    this.name.set('Mi edición');
    this.description.set('');
    this.symbol.set('€');
    this.scale.set('units');
    this.startingMoney.set(1500);
    this.goSalary.set(200);
    this.jailFine.set(50);
    this.incomeTax.set(200);
    this.luxuryTax.set(100);
    this.properties.set([this.newProperty()]);
    this.showEditor.set(true);
    this.error.set('');
  }

  protected edit(edition: Edition): void {
    if (edition.readonly) return;
    this.editingId.set(edition.id);
    this.name.set(edition.name);
    this.description.set(edition.description ?? '');
    this.symbol.set(edition.currency.symbol);
    this.scale.set(edition.currency.scale);
    this.startingMoney.set(edition.startingMoney);
    this.goSalary.set(edition.goSalary);
    this.jailFine.set(edition.jailFine);
    this.incomeTax.set(edition.incomeTax);
    this.luxuryTax.set(edition.luxuryTax);
    this.properties.set(edition.properties.map((p) => ({ ...p })));
    this.showEditor.set(true);
    this.error.set('');
  }

  protected addProperty(): void {
    this.properties.set([...this.properties(), this.newProperty()]);
  }

  protected removeProperty(index: number): void {
    const list = [...this.properties()];
    list.splice(index, 1);
    this.properties.set(list);
  }

  protected updateProperty(index: number, patch: Partial<PropertyMetadata>): void {
    const list = [...this.properties()];
    list[index] = { ...list[index], ...patch };
    this.properties.set(list);
  }

  protected updateRent(index: number, level: number, value: number): void {
    const list = [...this.properties()];
    const rents = [...list[index].rents];
    rents[level] = value;
    list[index] = { ...list[index], rents: rents as [number, number, number, number, number, number] };
    this.properties.set(list);
  }

  protected async save(): Promise<void> {
    if (!this.name().trim()) {
      this.error.set('El nombre es obligatorio');
      return;
    }
    if (this.properties().length === 0) {
      this.error.set('Añade al menos una propiedad');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    try {
      const edition: Edition = {
        id: this.editingId() ?? '',
        name: this.name().trim(),
        description: this.description().trim(),
        currency: { symbol: this.symbol(), code: 'CUSTOM', scale: this.scale() },
        startingMoney: this.startingMoney(),
        goSalary: this.goSalary(),
        jailFine: this.jailFine(),
        incomeTax: this.incomeTax(),
        luxuryTax: this.luxuryTax(),
        properties: this.properties(),
      };
      await this.editionService.save(edition);
      this.showEditor.set(false);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  protected async deleteEdition(id: string): Promise<void> {
    if (!confirm('¿Eliminar esta edición?')) return;
    await this.editionService.delete(id);
  }

  protected format(amount: number): string {
    return this.formatter.format(amount, { symbol: this.symbol(), code: 'CUSTOM', scale: this.scale() });
  }
}
