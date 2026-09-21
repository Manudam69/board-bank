import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'spacedCode',
})
export class SpacedCodePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    return value.split('').join(' ');
  }
}
