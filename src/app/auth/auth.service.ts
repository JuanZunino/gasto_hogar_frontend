import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
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
  private readonly tokenKey = 'gastohogar.token';

  get token(): string | null {
    return sessionStorage.getItem(this.tokenKey);
  }

  login(credentials: LoginCredentials) {
    return this.http.post<LoginResponse>('/api/v1/login', credentials).pipe(
      tap(({ token }) => sessionStorage.setItem(this.tokenKey, token)),
    );
  }

  profile() {
    return this.http.get<AuthUser>('/api/v1/profile');
  }

  logout(): void {
    sessionStorage.removeItem(this.tokenKey);
  }
}
