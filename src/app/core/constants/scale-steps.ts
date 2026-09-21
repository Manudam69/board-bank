export interface ScaleStep {
  id: '' | 'K' | 'M' | 'B' | 'T';
  label: string;
  factor: number;
}

export const SCALE_STEPS: readonly ScaleStep[] = [
  { id: '', label: '—', factor: 1 },
  { id: 'K', label: 'K', factor: 1_000 },
  { id: 'M', label: 'M', factor: 1_000_000 },
  { id: 'B', label: 'B', factor: 1_000_000_000 },
  { id: 'T', label: 'T', factor: 1_000_000_000_000 },
];
