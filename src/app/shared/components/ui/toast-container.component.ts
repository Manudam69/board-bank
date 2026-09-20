import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { ICONS } from '../../icons';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  templateUrl: './toast-container.component.html',
})
export class ToastContainerComponent {
  protected readonly toastService = inject(ToastService);
  protected readonly icons = ICONS;
}
