import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'arsAmount' })
export class ArsAmountPipe implements PipeTransform {
  transform(amount: string): string {
    // Format the decimal text directly, preserving precision even beyond Number.MAX_SAFE_INTEGER.
    const [integer, fraction = ''] = amount.split('.');
    const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `$\u00a0${grouped},${fraction.padEnd(2, '0')}`;
  }
}
