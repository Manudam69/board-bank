import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router, ActivatedRoute, type ParamMap } from '@angular/router';
import { of } from 'rxjs';
import { JoinComponent } from './join.component';
import { AuthService } from '../../core/services/auth.service';
import { RoomService } from '../../core/services/room.service';
import { EditionService } from '../../core/services/edition.service';
import { PlayerIdentityService } from '../../core/services/player-identity.service';
import { SoundService } from '../../core/services/sound.service';
import { CLASSIC_SPAIN } from '../../core/constants/editions';
import type { Room } from '../../core/models';

const ROOM_ID = 'ABCD1';
const USER_ID = 'uid-1';

function makeParamMap(id: string): ParamMap {
  return {
    get: (key: string) => (key === 'roomId' ? id : null),
    getAll: () => [],
    has: (key: string) => key === 'roomId',
    keys: ['roomId'],
    params: { roomId: id },
  } as unknown as ParamMap;
}

function makeRoom(status: Room['status']): Room {
  return {
    id: ROOM_ID,
    editionId: CLASSIC_SPAIN.id,
    hostId: USER_ID,
    status,
    players: [
      {
        id: USER_ID,
        name: 'Ana',
        avatarColor: 'bg-red-500',
        cash: 0,
        properties: [],
        bankrupt: false,
        host: true,
        joinedAt: 0,
      },
    ],
    log: [],
    trades: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('JoinComponent', () => {
  let navigateSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    navigateSpy = vi.fn();

    const auth = {
      userId: signal<string | null>(USER_ID),
      ready: signal(true),
      error: signal<string | null>(null),
    } as unknown as AuthService;

    const identity = {
      name: signal(''),
      setName: vi.fn(),
      clear: vi.fn(),
    } as unknown as PlayerIdentityService;

    const roomService = {
      getRoom: vi.fn(),
      joinRoom: vi.fn(),
    } as unknown as RoomService;

    TestBed.configureTestingModule({
      imports: [JoinComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: of(makeParamMap(ROOM_ID)) } },
        { provide: Router, useValue: { navigate: navigateSpy } },
        { provide: AuthService, useValue: auth },
        { provide: RoomService, useValue: roomService },
        { provide: EditionService, useValue: { editions: signal([CLASSIC_SPAIN]) } },
        { provide: PlayerIdentityService, useValue: identity },
        { provide: SoundService, useValue: { play: vi.fn() } },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('navigates to /history when the player rejoins a finished room', async () => {
    const roomService = TestBed.inject(RoomService);
    vi.mocked(roomService.getRoom).mockResolvedValue(makeRoom('finished'));

    const fixture = TestBed.createComponent(JoinComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith(['/history', ROOM_ID]);
  });

  it('navigates to /game when the player rejoins a playing room', async () => {
    const roomService = TestBed.inject(RoomService);
    vi.mocked(roomService.getRoom).mockResolvedValue(makeRoom('playing'));

    const fixture = TestBed.createComponent(JoinComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith(['/game', ROOM_ID]);
  });

  it('navigates to /lobby when the player rejoins an open lobby', async () => {
    const roomService = TestBed.inject(RoomService);
    vi.mocked(roomService.getRoom).mockResolvedValue(makeRoom('lobby'));

    const fixture = TestBed.createComponent(JoinComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith(['/lobby', ROOM_ID]);
  });

  it('shows "La partida ya ha terminado." for a non-player entering a finished room', async () => {
    const auth = TestBed.inject(AuthService);
    auth.userId.set('other-user');

    const roomService = TestBed.inject(RoomService);
    vi.mocked(roomService.getRoom).mockResolvedValue(makeRoom('finished'));

    const fixture = TestBed.createComponent(JoinComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.status()).toBe('error');
    expect(fixture.componentInstance.errorMessage()).toBe('La partida ya ha terminado.');
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('shows "La partida ya ha comenzado." for a non-player entering a playing room', async () => {
    const auth = TestBed.inject(AuthService);
    auth.userId.set('other-user');

    const roomService = TestBed.inject(RoomService);
    vi.mocked(roomService.getRoom).mockResolvedValue(makeRoom('playing'));

    const fixture = TestBed.createComponent(JoinComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.status()).toBe('error');
    expect(fixture.componentInstance.errorMessage()).toBe('La partida ya ha comenzado.');
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
