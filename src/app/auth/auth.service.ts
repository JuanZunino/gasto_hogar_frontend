import { HttpClient } from '@angular/common/http';
import { inject, Service, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

@Service()
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly currentUser = signal<AuthUser | null>(null);
  readonly user = this.currentUser.asReadonly();
  private readonly tokenKey = 'gastohogar.token';

  get token(): string | null {
    return sessionStorage.getItem(this.tokenKey);
  }

  login(credentials: LoginCredentials) {
    return this.http.post<LoginResponse>('/api/v1/login', credentials).pipe(
      tap(({ token, user }) => {
        sessionStorage.setItem(this.tokenKey, token);
        this.currentUser.set(user);
      }),
    );
  }

  profile() {
    return this.http.get<AuthUser>('/api/v1/profile').pipe(tap(user => this.currentUser.set(user)));
  }

  logout(): void {
    sessionStorage.removeItem(this.tokenKey);
    this.currentUser.set(null);
    void this.router.navigateByUrl('/login');
  }
}
