import {
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  model,
  signal,
} from '@angular/core';
import { SCALE_STEPS, type ScaleStep } from '../../../core/constants/scale-steps';
import type { CurrencyConfig, Edition } from '../../../core/models/edition.model';
import { MoneyFormatService } from '../../../core/services/money-format.service';

const STEP_BY_ID = new Map(SCALE_STEPS.map((s) => [s.id, s]));

const SUFFIX_REGEX = /([kKmMbBtT])$/;

function normalizeMantissa(value: string): string {
  return value
    .replace(/\s/g, '')
    .replace(/,/g, '')
    .replace(/[^0-9.]/g, (match) => (SUFFIX_REGEX.test(match) ? match : ''));
}

function parseMantissa(value: string): number | null {
  const normalized = normalizeMantissa(value);
  const parts = normalized.split('.');
  if (parts.length > 2) {
    parts.pop();
  }
  const candidate = parts.join('.');
  if (candidate === '' || candidate === '.') return null;
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : null;
}

function findSuffix(value: string): ScaleStep | null {
  const match = value.trim().match(SUFFIX_REGEX);
  if (!match) return null;
  return STEP_BY_ID.get(match[1].toUpperCase() as ScaleStep['id']) ?? null;
}

function formatMantissa(value: number | null): string {
  if (value === null || value === 0) return '';
  return value.toString();
}

@Component({
  selector: 'app-amount-input',
  templateUrl: './amount-input.component.html',
})
export class AmountInputComponent {
  private readonly formatter = inject(MoneyFormatService);

  readonly currency = input.required<CurrencyConfig>();
  readonly edition = input<Edition | undefined>(undefined);
  readonly label = input('Cantidad');
  readonly placeholder = input('0');
  readonly min = input(0);
  readonly max = input<number | undefined>(undefined);
  readonly amount = model(0);
  readonly disabled = input(false);

  readonly stepInfo = computed(() => {
    const edition = this.edition();
    if (!edition) {
      return {
        steps: [SCALE_STEPS[0]],
        defaultStep: SCALE_STEPS[0],
      };
    }
    return this.formatter.computeScaleSteps(edition);
  });

  readonly selectedStep = linkedSignal(() => this.stepInfo().defaultStep);

  readonly rawText = signal('');

  readonly value = computed(() => {
    const mantissa = parseMantissa(this.rawText());
    if (mantissa === null) return 0;
    return Math.max(0, Math.round(mantissa * this.selectedStep().factor));
  });

  readonly preview = computed(() => {
    return this.formatter.formatExact(this.value(), this.currency());
  });

  readonly exceedsMax = computed(() => {
    const max = this.max();
    return max !== undefined && this.value() > max;
  });

  readonly hasValue = computed(() => this.value() > 0);

  constructor() {
    effect(() => {
      this.amount.set(this.value());
    });

    effect(() => {
      const external = this.amount();
      const internal = this.value();
      if (external !== internal) {
        this.rawText.set(external === 0 ? '' : formatMantissa(external / this.selectedStep().factor));
      }
    });
  }

  protected onInput(value: string): void {
    const typedStep = findSuffix(value);
    const clean = normalizeMantissa(value.replace(SUFFIX_REGEX, ''));

    if (typedStep && this.isStepAvailable(typedStep)) {
      this.selectedStep.set(typedStep);
      this.rawText.set(clean);
      return;
    }

    this.rawText.set(clean);
  }

  protected selectStep(step: ScaleStep): void {
    this.selectedStep.set(step);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const key = event.key.toUpperCase();
    if (key === 'K' || key === 'M' || key === 'B' || key === 'T') {
      const step = STEP_BY_ID.get(key as ScaleStep['id']);
      if (step && this.isStepAvailable(step)) {
        event.preventDefault();
        this.selectedStep.set(step);
      }
    }
  }

  private isStepAvailable(step: ScaleStep): boolean {
    return this.stepInfo().steps.some((s) => s.id === step.id);
  }
}
