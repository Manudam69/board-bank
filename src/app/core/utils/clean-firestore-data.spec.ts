import { describe, it, expect } from 'vitest';
import { cleanFirestoreData } from './clean-firestore-data';

describe('cleanFirestoreData', () => {
  it('removes top-level undefined properties', () => {
    const input = { a: 1, b: undefined, c: 'keep' };
    const output = cleanFirestoreData(input);
    expect(output).toEqual({ a: 1, c: 'keep' });
  });

  it('removes nested undefined properties', () => {
    const input = { a: { b: undefined, c: 2 }, d: undefined };
    const output = cleanFirestoreData(input);
    expect(output).toEqual({ a: { c: 2 } });
  });

  it('cleans undefined values inside arrays', () => {
    const input = [
      { id: 'x', value: undefined },
      { id: 'y', value: 42 },
    ];
    const output = cleanFirestoreData(input);
    expect(output).toEqual([{ id: 'x' }, { id: 'y', value: 42 }]);
  });

  it('preserves null, numbers, booleans, strings and arrays', () => {
    const input = { a: null, b: 0, c: false, d: '', e: [1, 2, 3] };
    const output = cleanFirestoreData(input);
    expect(output).toEqual(input);
  });

  it('preserves non-plain objects such as Date', () => {
    const date = new Date('2026-09-20');
    const input = { timestamp: date, removed: undefined };
    const output = cleanFirestoreData(input);
    expect(output).toEqual({ timestamp: date });
  });
});
