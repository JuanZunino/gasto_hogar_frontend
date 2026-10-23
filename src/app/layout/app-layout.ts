import { Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { AppIcon } from './app-icon';

@Component({
  selector: 'app-layout',
  imports: [RouterLink, RouterLinkActive, AppIcon],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.scss',
  host: { '(keydown.escape)': 'closeMenu(true)' },
})
export class AppLayout {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly menuButton = viewChild<ElementRef<HTMLButtonElement>>('menuButton');
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');
  protected readonly menuOpen = signal(false);
  private readonly navigation = toSignal(this.router.events.pipe(
    filter(event => event instanceof NavigationEnd),
    map(() => this.router.routerState.snapshot),
  ), { initialValue: this.router.routerState.snapshot });
  protected readonly authenticated = computed(() => {
    let route = this.navigation().root;
    while (route.firstChild) route = route.firstChild;
    return route.data['authenticatedLayout'] === true;
  });

  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.closeMenu());
  }

  protected toggleMenu(): void { this.menuOpen.update(open => !open); }

  protected closeMenu(restoreFocus = false): void {
    if (!this.menuOpen()) return;
    this.menuOpen.set(false);
    if (restoreFocus) this.menuButton()?.nativeElement.focus();
  }

  protected skipToContent(event: Event): void {
    event.preventDefault();
    this.closeMenu();
    this.main().nativeElement.focus();
  }
}
