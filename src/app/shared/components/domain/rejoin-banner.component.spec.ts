import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { RejoinBannerComponent } from './rejoin-banner.component';
import { EditionService } from '../../../core/services/edition.service';
import { SoundService } from '../../../core/services/sound.service';
import { ButtonComponent } from '../ui/button.component';
import { SpacedCodePipe } from '../../pipes/spaced-code.pipe';
import type { Room } from '../../../core/models';

const ROOM: Room = {
  id: 'ABCDE',
  editionId: 'classic-spain',
  hostId: 'uid-1',
  status: 'playing',
  players: [
    {
      id: 'uid-1',
      name: 'Ana',
      avatarColor: 'bg-red-500',
      cash: 1500,
      properties: [],
      bankrupt: false,
      host: true,
      joinedAt: 0,
    },
  ],
  log: [],
  trades: [],
  createdAt: 0,
  updatedAt: Date.now(),
};

describe('RejoinBannerComponent', () => {
  let fixture: ComponentFixture<RejoinBannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RejoinBannerComponent, ButtonComponent, SpacedCodePipe],
      providers: [
        {
          provide: EditionService,
          useValue: {
            editions: signal([
              { id: 'classic-spain', name: 'Clásica España', properties: [], currency: { symbol: '€' }, startingMoney: 1500 },
            ]),
          },
        },
        {
          provide: SoundService,
          useValue: { play: vi.fn(), enabled: signal(false), toggle: vi.fn() },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RejoinBannerComponent);
    fixture.componentRef.setInput('room', ROOM);
    fixture.detectChanges();
  });

  it('renders room code and edition name', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Tienes una partida en curso');
    expect(compiled.textContent).toContain('Clásica España');
  });

  it('emits dismissAction when ignore is clicked', () => {
    const dismissSpy = vi.fn();
    fixture.componentInstance.dismissAction.subscribe(dismissSpy);

    const compiled = fixture.nativeElement as HTMLElement;
    const ignoreButton = compiled.querySelector('button');
    expect(ignoreButton).not.toBeNull();

    // Click the second button if available (the ignore one is the smaller ghost button after the primary one)
    const buttons = compiled.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    buttons[buttons.length - 1].click();

    expect(dismissSpy).toHaveBeenCalledOnce();
  });
});
