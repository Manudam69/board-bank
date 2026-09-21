import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BankActionsBarComponent, type BankAction } from './bank-actions-bar.component';

describe('BankActionsBarComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<BankActionsBarComponent>>;
  let emittedActions: BankAction[];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(BankActionsBarComponent);
    emittedActions = [];
    fixture.componentInstance.action.subscribe((a) => emittedActions.push(a));
    fixture.detectChanges();
  });

  it('renders rent as the primary pill', () => {
    const primaryButton = fixture.nativeElement.querySelector('button.rounded-full.bg-accent');
    expect(primaryButton).toBeTruthy();
    expect(primaryButton.textContent).toContain('Pagar renta');
  });

  it('emits rent when primary pill is clicked', () => {
    const primaryButton = fixture.nativeElement.querySelector('button.rounded-full.bg-accent');
    primaryButton.click();
    expect(emittedActions).toEqual(['rent']);
  });

  it('emits quick actions', () => {
    const quickButtons = fixture.nativeElement.querySelectorAll(
      '.inline-flex.flex-col.items-center, .inline-flex.sm\\:flex-row.items-center',
    );
    expect(quickButtons.length).toBeGreaterThan(0);
    const transferButton = Array.from(quickButtons).find((b) =>
      (b as HTMLElement).textContent?.includes('Transferir'),
    ) as HTMLElement | undefined;
    expect(transferButton).toBeTruthy();
    transferButton!.click();
    expect(emittedActions).toContain('transfer');
  });

  it('opens the more menu and emits extra actions', () => {
    const moreButton = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((b) => (b as HTMLElement).textContent?.includes('Más')) as HTMLElement;
    expect(moreButton).toBeTruthy();
    moreButton.click();
    fixture.detectChanges();

    const menuButtons = fixture.nativeElement.querySelectorAll('[role="menuitem"]');
    expect(menuButtons.length).toBeGreaterThan(0);
    const firstExtra = menuButtons[0] as HTMLElement;
    firstExtra.click();
    expect(emittedActions.length).toBe(1);
  });
});
