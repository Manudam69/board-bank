import {
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import type { Room } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { EditionService } from '../../core/services/edition.service';
import { PlayerIdentityService } from '../../core/services/player-identity.service';
import { RoomService } from '../../core/services/room.service';
import { SoundService } from '../../core/services/sound.service';
import { mapFirebaseError } from '../../core/utils/firebase-errors';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { SpinnerComponent } from '../../shared/components/ui/spinner.component';
import { PlayerNameStepComponent } from '../../shared/components/domain/player-name-step.component';
import { SpacedCodePipe } from '../../shared/pipes/spaced-code.pipe';

type JoinPageStatus = 'waiting-auth' | 'checking' | 'need-name' | 'joining' | 'error';

@Component({
  selector: 'app-join',
  imports: [
    ButtonComponent,
    SpinnerComponent,
    PlayerNameStepComponent,
    SpacedCodePipe,
  ],
  template: `
    <div class="relative mx-auto flex min-h-svh max-w-md flex-col items-center justify-center px-4 py-6">
      <div class="w-full animate-fade-in rounded-2xl border border-border bg-surface p-6 text-center">
        @switch (status()) {
          @case ('waiting-auth') {
            <app-spinner label="Conectando..." />
          }

          @case ('checking') {
            <app-spinner [label]="'Cargando invitación...'" />
          }

          @case ('need-name') {
            <div class="flex flex-col gap-5">
              <div class="flex flex-col items-center gap-2">
                <p class="text-sm font-medium text-text-secondary">
                  Te han invitado a una partida
                </p>
                @if (room()) {
                  <div class="rounded-xl border border-border bg-surface-elevated/50 px-4 py-2">
                    <p class="text-2xl font-black tracking-[0.35em] text-text">
                      {{ room()!.id | spacedCode }}
                    </p>
                    @if (editionName()) {
                      <p class="mt-1 text-xs text-text-muted">
                        {{ editionName() }} · {{ room()!.players.length }}/8 jugadores
                      </p>
                    }
                  </div>
                }
              </div>

              @if (joinError()) {
                <p class="flex items-center justify-center gap-1.5 text-sm text-negative" role="alert">
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
                  {{ joinError() }}
                </p>
              }

              <app-player-name-step
                [(name)]="name"
                continueLabel="Unirse a la partida →"
                (nextAction)="setNameAndJoin()"
              />
            </div>
          }

          @case ('joining') {
            <div class="flex flex-col items-center gap-3">
              <app-spinner label="Uniéndote a la partida..." />
              @if (room()) {
                <p class="text-sm text-text-muted">
                  {{ room()!.id | spacedCode }} · {{ editionName() }}
                </p>
              }
            </div>
          }

          @case ('error') {
            <div class="flex flex-col items-center gap-4">
              <div class="rounded-full bg-danger-muted p-4 text-negative">
                <svg
                  class="h-8 w-8"
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
              </div>
              <p class="text-lg text-negative">{{ errorMessage() }}</p>
              <app-button variant="secondary" (clickAction)="router.navigate(['/'])">
                Volver al inicio
              </app-button>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class JoinComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly roomService = inject(RoomService);
  private readonly identity = inject(PlayerIdentityService);
  private readonly editions = inject(EditionService);
  private readonly soundService = inject(SoundService);

  readonly rawRoomId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('roomId') ?? '')),
  );
  readonly roomId = computed(() => this.rawRoomId()?.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) ?? '');

  readonly room = signal<Room | null>(null);
  readonly status = signal<JoinPageStatus>('waiting-auth');
  readonly errorMessage = signal('');
  readonly joinError = signal('');
  readonly name = linkedSignal(() => this.identity.name());

  readonly editionName = computed(() => {
    const id = this.room()?.editionId;
    if (!id) return undefined;
    return this.editions.editions().find((e) => e.id === id)?.name;
  });

  constructor() {
    effect(() => {
      if (this.auth.ready() && this.status() === 'waiting-auth') {
        this.checkRoom();
      }
    });
  }

  private async checkRoom(): Promise<void> {
    const id = this.roomId();
    if (!id) {
      this.fail('El enlace no es válido.');
      return;
    }

    this.status.set('checking');
    try {
      const room = await this.roomService.getRoom(id);
      if (!room) {
        this.fail('Sala no encontrada. Revisa el enlace.');
        return;
      }

      const uid = this.auth.userId();
      const isPlayer = room.players.some((p) => p.id === uid);

      if (isPlayer) {
        if (room.status === 'finished') {
          this.router.navigate(['/history', room.id]);
        } else if (room.status === 'playing') {
          this.router.navigate(['/game', room.id]);
        } else {
          this.router.navigate(['/lobby', room.id]);
        }
        return;
      }

      if (room.status === 'finished') {
        this.fail('La partida ya ha terminado.');
        return;
      }

      if (room.status !== 'lobby') {
        this.fail('La partida ya ha comenzado.');
        return;
      }

      this.room.set(room);
      if (this.identity.name().trim()) {
        await this.join();
      } else {
        this.status.set('need-name');
      }
    } catch (e) {
      this.fail(mapFirebaseError(e));
    }
  }

  protected setNameAndJoin(): void {
    const trimmed = this.name().trim();
    if (!trimmed) return;
    this.identity.setName(trimmed);
    this.join();
  }

  private async join(): Promise<void> {
    const id = this.roomId();
    const name = this.identity.name().trim();
    if (!id || !name) {
      this.status.set('need-name');
      return;
    }

    this.status.set('joining');
    this.joinError.set('');

    try {
      const room = await this.roomService.joinRoom(id, name);
      this.soundService.play('success');
      this.router.navigate(['/lobby', room.id]);
    } catch (e) {
      const message = mapFirebaseError(e);
      this.joinError.set(message);
      this.soundService.play('error');
      this.status.set('need-name');
    }
  }

  private fail(message: string): void {
    this.errorMessage.set(message);
    this.status.set('error');
  }
}
