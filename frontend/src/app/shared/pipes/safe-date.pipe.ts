import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'safeDate', standalone: true, pure: true })
export class SafeDatePipe implements PipeTransform {
  transform(value: unknown, format: string = 'dd MMM yyyy'): string {
    if (!value) return '—';
    try {
      const date = value instanceof Date ? value : new Date(value as string);
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
    } catch {
      return '—';
    }
  }
}
