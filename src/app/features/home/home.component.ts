import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { EditionService } from '../../core/services/edition.service';
import { RoomService } from '../../core/services/room.service';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { ModalComponent } from '../../shared/components/ui/modal.component';
import { SpinnerComponent } from '../../shared/components/ui/spinner.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { mapFirebaseError } from '../../core/utils/firebase-errors';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule, RouterLink, ButtonComponent, ModalComponent, SpinnerComponent, MoneyPipe],
  templateUrl: './home.component.html',
})
export class HomeComponent {
  private readonly router = inject(Router);
  private readonly editionsService = inject(EditionService);
  private readonly roomService = inject(RoomService);
  private readonly auth = inject(AuthService);

  readonly authReady = this.auth.ready;
  readonly authError = this.auth.error;
  readonly editions = computed(() => this.editionsService.editions());
  readonly loadingEditions = computed(() => this.editionsService.loading());
  readonly selectedEdition = computed(() =>
    this.editions().find((e) => e.id === this.selectedEditionId()),
  );

  readonly joinCode = signal('');
  readonly joinName = signal('');
  readonly createName = signal('');
  readonly selectedEditionId = signal<string | undefined>(undefined);
  readonly showCreateModal = signal(false);
  readonly processing = signal(false);
  readonly error = signal('');

  protected openCreate(): void {
    if (this.editions().length > 0 && !this.selectedEditionId()) {
      this.selectedEditionId.set(this.editions()[0].id);
    }
    this.showCreateModal.set(true);
    this.error.set('');
  }

  protected async createRoom(): Promise<void> {
    const name = this.createName().trim();
    const editionId = this.selectedEditionId();
    if (!name || !editionId) return;

    this.processing.set(true);
    this.error.set('');
    try {
      const room = await this.roomService.createRoom(editionId, name);
      this.router.navigate(['/lobby', room.id]);
    } catch (e) {
      this.error.set(mapFirebaseError(e));
    } finally {
      this.processing.set(false);
    }
  }

  protected async joinRoom(): Promise<void> {
    const code = this.joinCode().trim().toUpperCase();
    const name = this.joinName().trim();
    if (!code || !name) return;

    this.processing.set(true);
    this.error.set('');
    try {
      await this.roomService.joinRoom(code, name);
      this.router.navigate(['/lobby', code]);
    } catch (e) {
      this.error.set(mapFirebaseError(e));
    } finally {
      this.processing.set(false);
    }
  }
}
