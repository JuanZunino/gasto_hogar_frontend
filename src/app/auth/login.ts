import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  template: `
    <h1 tabindex="-1" #heading>Iniciar sesión</h1>
    <form [formGroup]="form" (ngSubmit)="submit()" [attr.aria-busy]="loading()" novalidate>
      <div class="field">
        <label for="email">Email</label>
        <input id="email" type="email" formControlName="email" autocomplete="username" required
          [attr.aria-invalid]="form.controls.email.touched && form.controls.email.invalid"
          aria-describedby="email-error" />
        <span id="email-error">
          @if (form.controls.email.touched && form.controls.email.hasError('required')) {
            Ingresá tu email.
          } @else if (form.controls.email.touched && form.controls.email.hasError('email')) {
            Ingresá un email válido.
          }
        </span>
      </div>
      <div class="field">
        <label for="password">Contraseña</label>
        <input id="password" type="password" formControlName="password" autocomplete="current-password" required
          [attr.aria-invalid]="form.controls.password.touched && form.controls.password.invalid"
          aria-describedby="password-error" />
        <span id="password-error">
          @if (form.controls.password.touched && form.controls.password.invalid) {
            Ingresá tu contraseña.
          }
        </span>
      </div>
      @if (error()) { <p role="alert">{{ error() }}</p> }
      <p role="status">{{ loading() ? 'Iniciando sesión…' : '' }}</p>
      <button type="submit" [disabled]="loading()">Ingresar</button>
    </form>
  `,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('heading');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  ngAfterViewInit(): void {
    this.heading().nativeElement.focus();
  }

  protected submit(): void {
    if (this.loading()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.form.getRawValue()).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: () => {
        this.form.controls.password.reset();
        void this.router.navigateByUrl('/inicio');
      },
      error: (error: unknown) => {
        this.error.set(error instanceof HttpErrorResponse && [401, 403].includes(error.status)
          ? 'Email o contraseña incorrectos.'
          : 'No se pudo iniciar sesión. Verificá tu conexión e intentá nuevamente.');
      },
    });
  }
}
