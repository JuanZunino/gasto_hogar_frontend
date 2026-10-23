import { Component, input } from '@angular/core';

type IconName = 'home' | 'dashboard' | 'expenses' | 'logout' | 'menu' | 'close';

@Component({
  selector: 'app-icon',
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path [attr.d]="paths[name()]" />
    </svg>
  `,
  styles: `:host { display: inline-flex; width: 1.4rem; height: 1.4rem; flex: 0 0 auto; } svg { width: 100%; height: 100%; }`,
})
export class AppIcon {
  readonly name = input.required<IconName>();
  protected readonly paths: Record<IconName, string> = {
    home: 'M3 10 12 3l9 7M5 9v11h14V9M9 20v-7h6v7',
    dashboard: 'M4 4h6v7H4zM14 4h6v4h-6zM4 15h6v5H4zM14 12h6v8h-6z',
    expenses: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 7h6M9 11h6M9 15h3',
    logout: 'M9 4H4v16h5M13 8l4 4-4 4M8 12h13',
    menu: 'M4 6h16M4 12h16M4 18h16',
    close: 'm6 6 12 12M6 18 18 6',
  };
}
