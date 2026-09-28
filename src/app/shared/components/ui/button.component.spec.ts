import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ButtonComponent } from './button.component';

describe('ButtonComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<ButtonComponent>>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ButtonComponent] });
    fixture = TestBed.createComponent(ButtonComponent);
  });

  function buttonEl(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button');
  }

  it('renders primary pill by default', () => {
    fixture.detectChanges();
    const classes = buttonEl().className;
    expect(classes).toContain('bg-accent');
    expect(classes).toContain('text-white');
    expect(classes).toContain('rounded-full');
  });

  it('supports soft variant with visible background and border', () => {
    fixture.componentRef.setInput('variant', 'soft');
    fixture.detectChanges();
    const classes = buttonEl().className;
    expect(classes).toContain('bg-surface-hover');
    expect(classes).toContain('text-text');
    expect(classes).toContain('border');
    expect(classes).toContain('border-border');
  });

  it('supports shape=lg with rounded-xl', () => {
    fixture.componentRef.setInput('shape', 'lg');
    fixture.detectChanges();
    expect(buttonEl().className).toContain('rounded-xl');
    expect(buttonEl().className).not.toContain('rounded-full');
  });

  it('forwards aria-label to the inner button', () => {
    fixture.componentRef.setInput('ariaLabel', 'Construir casa en Ronda');
    fixture.detectChanges();
    expect(buttonEl().getAttribute('aria-label')).toBe('Construir casa en Ronda');
  });

  it('disables the button and does not emit clickAction', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    let emitted = false;
    fixture.componentInstance.clickAction.subscribe(() => (emitted = true));
    buttonEl().click();
    expect(emitted).toBe(false);
    expect(buttonEl().disabled).toBe(true);
  });
});
