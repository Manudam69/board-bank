import { Component, input, output } from '@angular/core';
import { ButtonComponent } from './button.component';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './confirm-dialog.component.html',
})
export class ConfirmDialogComponent {
  readonly open = input.required<boolean>();
  readonly title = input('Confirmar');
  readonly message = input('¿Estás seguro?');
  readonly confirmLabel = input('Confirmar');
  readonly cancelLabel = input('Cancelar');
  readonly confirmVariant = input<'primary' | 'danger'>('danger');

  readonly confirmed = output<boolean>();

  protected cancel(): void {
    this.confirmed.emit(false);
  }

  protected confirm(): void {
    this.confirmed.emit(true);
  }
}
