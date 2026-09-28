import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { ICONS } from '../../icons';
import { ToastSwipeDirective } from './toast-swipe.directive';

@Component({
  selector: 'app-toast-container',
  imports: [ToastSwipeDirective],
  templateUrl: './toast-container.component.html',
})
export class ToastContainerComponent {
  protected readonly toastService = inject(ToastService);
  protected readonly icons = ICONS;
}
