import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router, ActivatedRoute, type ParamMap } from '@angular/router';
import { Location } from '@angular/common';
import { of } from 'rxjs';
import { LobbyComponent } from './lobby.component';
import { GameStateService } from '../../core/services/game-state.service';
import { RoomService } from '../../core/services/room.service';
import { EditionService } from '../../core/services/edition.service';
import { AuthService } from '../../core/services/auth.service';
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

function mockMatchMedia(reducedMotion = false): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: reducedMotion,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('LobbyComponent', () => {
  let navigateSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockMatchMedia(false);

    navigateSpy = vi.fn();

    const gameState = {
      room: signal<Room | null>(null),
      loading: signal(false),
      error: signal<string | null>(null),
      connected: signal(false),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      runInTransaction: vi.fn(),
      roomRef: vi.fn(),
    } as unknown as GameStateService;

    const auth = {
      userId: signal(USER_ID),
      ready: signal(true),
      error: signal<string | null>(null),
    } as unknown as AuthService;

    TestBed.configureTestingModule({
      imports: [LobbyComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: of(makeParamMap(ROOM_ID)) } },
        { provide: Router, useValue: { navigate: navigateSpy } },
        { provide: Location, useValue: { prepareExternalUrl: (url: string) => url } },
        { provide: GameStateService, useValue: gameState },
        { provide: RoomService, useValue: { leaveRoom: vi.fn(), startGame: vi.fn() } },
        { provide: EditionService, useValue: { editions: signal([CLASSIC_SPAIN]) } },
        { provide: AuthService, useValue: auth },
        { provide: SoundService, useValue: { play: vi.fn() } },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('redirects to /history when the room is finished', async () => {
    const gameState = TestBed.inject(GameStateService);
    const fixture = TestBed.createComponent(LobbyComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    gameState.room.set(makeRoom('finished'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith(['/history', ROOM_ID]);
  });

  it('redirects to /game when the room starts playing', async () => {
    const gameState = TestBed.inject(GameStateService);
    const fixture = TestBed.createComponent(LobbyComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    gameState.room.set(makeRoom('playing'));
    fixture.detectChanges();
    await fixture.whenStable();

    vi.advanceTimersByTime(700);
    await fixture.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith(['/game', ROOM_ID]);
  });

  it('stays in the lobby while the room is still open', async () => {
    const gameState = TestBed.inject(GameStateService);
    const fixture = TestBed.createComponent(LobbyComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    gameState.room.set(makeRoom('lobby'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
