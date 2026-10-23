import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-home',
  template: `
    <h1 tabindex="-1" #heading>Inicio</h1>
    @if (loading()) { <p role="status">Cargando perfil…</p> }
    @if (user(); as profile) {
      <section class="card" aria-label="Tu cuenta">
        <h2>Bienvenido/a, {{ profile.name }}</h2>
        <p>Email: {{ profile.email }}</p>
      </section>
    }
    @if (error()) { <p role="alert">{{ error() }}</p> }
  `,
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
