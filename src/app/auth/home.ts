import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DashboardIcon } from '../dashboard/dashboard-icon';
import { AppIcon } from '../layout/app-icon';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink, DashboardIcon, AppIcon],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('heading');
  protected readonly user = this.auth.user;
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  ngOnInit(): void {
    this.auth.profile().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        if (error instanceof HttpErrorResponse && [401, 403].includes(error.status)) {
          this.auth.logout();
        } else {
          this.error.set('No se pudo cargar tu perfil. Intentá nuevamente más tarde.');
        }
      },
    });
  }

  ngAfterViewInit(): void {
    this.heading().nativeElement.focus();
  }
}
