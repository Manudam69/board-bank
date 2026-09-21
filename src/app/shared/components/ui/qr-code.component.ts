import {
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import qrcode from 'qrcode-generator';

@Component({
  selector: 'app-qr-code',
  template: `
    <div
      class="flex items-center justify-center"
      [style.width.px]="size()"
      [style.height.px]="size()"
      role="img"
      [attr.aria-label]="alt()"
      [innerHTML]="svgHtml()"
    ></div>
  `,
})
export class QrCodeComponent {
  readonly value = input.required<string>();
  readonly size = input<number>(128);
  readonly alt = input<string>('Código QR para unirse a la partida');

  private readonly sanitizer = inject(DomSanitizer);
  protected readonly svgHtml = signal<SafeHtml | null>(null);

  constructor() {
    effect(() => {
      const text = this.value();
      if (!text) {
        this.svgHtml.set(null);
        return;
      }
      try {
        const qr = qrcode(0, 'M');
        qr.addData(text);
        qr.make();
        const svg = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
        this.svgHtml.set(this.sanitizer.bypassSecurityTrustHtml(svg));
      } catch {
        this.svgHtml.set(null);
      }
    });
  }
}
