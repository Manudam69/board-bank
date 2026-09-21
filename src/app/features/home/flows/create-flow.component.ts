import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EditionService } from '../../../core/services/edition.service';
import { PlayerIdentityService } from '../../../core/services/player-identity.service';
import { RoomService } from '../../../core/services/room.service';
import { SoundService } from '../../../core/services/sound.service';
import { mapFirebaseError } from '../../../core/utils/firebase-errors';
import { ButtonComponent } from '../../../shared/components/ui/button.component';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';

@Component({
  selector: 'app-create-flow',
  imports: [FormsModule, ButtonComponent, MoneyPipe],
  template: `
    <div class="flex flex-col gap-4">
      <div class="text-center">
        <p class="text-sm text-text-secondary">¿Qué edición jugarán?</p>
      </div>

      <!-- Identity -->
      <div class="rounded-xl border border-border bg-surface-elevated/50 px-4 py-3">
        @if (editingName()) {
          <div class="flex flex-col gap-2">
            <label for="create-player-name" class="text-sm font-medium text-text-secondary"
              >¿Cómo te llamas?</label
            >
            <input
              id="create-player-name"
              type="text"
              maxlength="20"
              autocomplete="off"
              autocorrect="off"
              spellcheck="false"
              class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-center text-base text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
              placeholder="Manuel"
              [ngModel]="name()"
              (ngModelChange)="name.set($event); tried.set(false)"
              (keydown.enter)="saveName()"
            />
            @if (showNameError()) {
              <p class="flex items-center gap-1.5 text-sm text-negative" role="alert">
                <svg
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 9v2m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
                  />
                </svg>
                Introduce un nombre
              </p>
            }
            <div class="flex gap-2">
              <app-button
                variant="secondary"
                size="sm"
                [fullWidth]="true"
                [disabled]="!name().trim()"
                (clickAction)="saveName()"
              >
                Guardar
              </app-button>
              @if (identity.name().trim()) {
                <app-button
                  variant="ghost"
                  size="sm"
                  [fullWidth]="true"
                  (clickAction)="cancelEditName()"
                >
                  Cancelar
                </app-button>
              }
            </div>
          </div>
        } @else {
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white"
                aria-hidden="true"
              >
                {{ initials() }}
              </div>
              <div class="min-w-0">
                <p class="text-xs text-text-muted">Entrarás como</p>
                <p class="truncate font-medium text-text">{{ identity.name() }}</p>
              </div>
            </div>
            <button
              type="button"
              class="shrink-0 text-xs font-medium text-text-secondary transition hover:text-text"
              (click)="startEditName()"
            >
              Cambiar
            </button>
          </div>
        }
      </div>

      <!-- Editions -->
      @if (editionsLoading()) {
        <div class="space-y-3">
          @for (_ of [1, 2, 3]; track $index) {
            <div class="h-20 animate-shimmer rounded-lg"></div>
          }
        </div>
      } @else {
        <div
          class="flex flex-col gap-2"
          role="radiogroup"
          aria-label="Selecciona una edición de Monopoly"
        >
          @for (edition of editions(); track edition.id) {
            <button
              type="button"
              role="radio"
              [attr.aria-checked]="selectedEditionId() === edition.id"
              class="flex items-center justify-between rounded-xl border px-4 py-3 text-left transition focus:outline-none"
              [class.border-border]="selectedEditionId() !== edition.id"
              [class.bg-surface-elevated]="selectedEditionId() !== edition.id"
              [class.border-accent]="selectedEditionId() === edition.id"
              [class.bg-accent-muted]="selectedEditionId() === edition.id"
              (click)="selectEdition(edition.id)"
            >
              <div class="min-w-0">
                <p class="truncate font-semibold text-text">{{ edition.name }}</p>
                <p class="text-xs text-text-secondary">
                  {{ edition.properties.length }} propiedades · Dinero inicial
                  {{ edition.startingMoney | money: edition.currency }}
                </p>
              </div>
              @if (selectedEditionId() === edition.id) {
                <span
                  class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-white"
                >
                  <svg
                    class="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="3"
                    aria-hidden="true"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              }
            </button>
          }
        </div>
      }

      @if (error()) {
        <p class="flex items-center gap-1.5 text-sm text-negative" role="alert">
          <svg
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 9v2m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
            />
          </svg>
          {{ error() }}
        </p>
      }

      <app-button
        [fullWidth]="true"
        size="lg"
        [loading]="processing()"
        [disabled]="!canCreate()"
        (clickAction)="create()"
      >
        Crear partida
      </app-button>
    </div>
  `,
})
export class CreateFlowComponent {
  private readonly router = inject(Router);
  protected readonly identity = inject(PlayerIdentityService);
  private readonly roomService = inject(RoomService);
  private readonly editionsService = inject(EditionService);
  private readonly soundService = inject(SoundService);

  readonly name = signal(this.identity.name());
  readonly editingName = signal(this.identity.name().trim() === '');
  readonly tried = signal(false);
  readonly selectedEditionId = signal<string | undefined>(undefined);
  readonly processing = signal(false);
  readonly error = signal('');

  readonly editions = computed(() => this.editionsService.editions());
  readonly editionsLoading = computed(() => this.editionsService.loading());
  readonly selectedEdition = computed(() =>
    this.editions().find((e) => e.id === this.selectedEditionId()),
  );
  readonly canCreate = computed(
    () => Boolean(this.identity.name().trim() && this.selectedEditionId()) && !this.processing(),
  );
  readonly showNameError = computed(() => this.tried() && !this.name().trim());
  readonly initials = computed(() => this.identity.name().trim().slice(0, 2).toUpperCase() || '?');

  constructor() {
    effect(() => {
      if (!this.selectedEditionId() && this.editions().length > 0) {
        this.selectedEditionId.set(this.editions()[0].id);
      }
    });
  }

  protected startEditName(): void {
    this.name.set(this.identity.name());
    this.editingName.set(true);
    this.tried.set(false);
  }

  protected cancelEditName(): void {
    this.name.set(this.identity.name());
    this.editingName.set(false);
    this.tried.set(false);
  }

  protected saveName(): void {
    const trimmed = this.name().trim();
    if (!trimmed) {
      this.tried.set(true);
      return;
    }
    this.identity.setName(trimmed);
    this.editingName.set(false);
    this.tried.set(false);
  }

  protected selectEdition(id: string): void {
    this.selectedEditionId.set(id);
    this.error.set('');
  }

  protected async create(): Promise<void> {
    if (this.editingName() && !this.name().trim()) {
      this.tried.set(true);
      return;
    }

    const name = this.identity.name().trim();
    const editionId = this.selectedEditionId();
    if (!name || !editionId) return;

    this.processing.set(true);
    this.error.set('');
    try {
      const room = await this.roomService.createRoom(editionId, name);
      this.soundService.play('success');
      this.router.navigate(['/lobby', room.id]);
    } catch (e) {
      this.error.set(mapFirebaseError(e));
    } finally {
      this.processing.set(false);
    }
  }
}
