import { describe, it, expect } from 'vitest';
import { needsDarkGroupText, needsGroupBorder } from './property-group';

describe('property-group helpers', () => {
  it('needsGroupBorder for low-contrast colors', () => {
    expect(needsGroupBorder('#ffffff')).toBe(true);
    expect(needsGroupBorder('#FFFF00')).toBe(true);
    expect(needsGroupBorder('#000000')).toBe(true);
    expect(needsGroupBorder('#FF0000')).toBe(false);
    expect(needsGroupBorder('#4F46E5')).toBe(false);
  });

  it('needsDarkGroupText for light colors', () => {
    expect(needsDarkGroupText('#ffffff')).toBe(true);
    expect(needsDarkGroupText('#FFFF00')).toBe(true);
    expect(needsDarkGroupText('#F1C40F')).toBe(true);
    expect(needsDarkGroupText('#FFEB3B')).toBe(true);
    expect(needsDarkGroupText('#000000')).toBe(false);
    expect(needsDarkGroupText('#4F46E5')).toBe(false);
  });
});
