import { Component, input } from '@angular/core';

export type DashboardIconName = 'wallet' | 'receipt' | 'cart' | 'house' | 'car' | 'cross' | 'book' | 'ticket' | 'category' | 'calendar';

@Component({
  selector: 'app-dashboard-icon',
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path [attr.d]="paths[name()]" />
    </svg>
  `,
  styles: `:host { display: inline-flex; width: 1.5rem; height: 1.5rem; flex: 0 0 auto; } svg { width: 100%; height: 100%; }`,
})
export class DashboardIcon {
  readonly name = input.required<DashboardIconName>();
  protected readonly paths: Record<DashboardIconName, string> = {
    wallet: 'M20 8V5H5a2 2 0 0 1 0-4h13v4M5 5H3v15h17V8H5M20 11h-6v5h6M17 13.5h.01',
    receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 7h6M9 11h6M9 15h3',
    cart: 'M2 3h3l3 12h11l3-8H6M9 20h.01M18 20h.01M8 15l-1 3h13',
    house: 'M3 10 12 3l9 7M5 9v11h14V9M9 20v-7h6v7',
    car: 'm5 7 2-4h10l2 4 2 3v8H3v-8l2-3ZM5 7h14M3 12h18M6 15h2M16 15h2M5 18v3M19 18v3',
    cross: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z',
    book: 'M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1v15M5 8h4M15 8h4',
    ticket: 'M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4V6ZM15 6v2M15 11v2M15 16v2',
    category: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    calendar: 'M4 5h16v16H4V5ZM8 2v6M16 2v6M4 11h16M8 15h2M14 15h2',
  };
}
