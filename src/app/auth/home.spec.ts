import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { authInterceptor } from './auth.interceptor';

const profile = { id: 5, name: 'Lucía Fernández', email: 'lucia@example.com', role: 'member' };

describe('Home presentation', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('gastohogar.token', 'test-token');
    TestBed.configureTestingModule({ providers: [
      provideRouter(routes), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
    ] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); sessionStorage.clear(); });
  async function stable(harness: RouterTestingHarness) {
    await harness.fixture.whenStable(); harness.detectChanges();
  }

  it('greets the real user and presents exactly the three implemented quick destinations without requesting statistics', async () => {
    const harness = await RouterTestingHarness.create('/inicio');
    expect(harness.routeNativeElement!.textContent).toContain('Cargando perfil');
    expect(harness.routeNativeElement!.querySelector('h1')!.textContent).toContain('Bienvenido/a a GastoHogar');
    const request = http.expectOne('/api/v1/profile');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush(profile); await stable(harness);
    const element = harness.routeNativeElement!;
    expect(element.querySelector('h1')!.textContent).toContain('Hola, Lucía Fernández');
    expect(element.textContent).toContain(profile.email);
    expect([...element.querySelectorAll<HTMLAnchorElement>('.quick-card')].map(link => link.getAttribute('href')))
      .toEqual(['/gastos/nuevo', '/gastos', '/dashboard']);
    expect(element.querySelectorAll('h1')).toHaveLength(1);
    expect(element.querySelectorAll('.quick-icon svg[aria-hidden="true"]')).toHaveLength(3);
    http.expectNone('/api/v1/dashboard');
    http.expectNone('/api/v1/expenses');
    http.expectNone('/api/v1/profile');
  });

  it.each(['/gastos/nuevo', '/gastos', '/dashboard'])('follows the quick link to %s and loads its real API', async destination => {
    const harness = await RouterTestingHarness.create('/inicio');
    http.expectOne('/api/v1/profile').flush(profile); await stable(harness);
    harness.routeNativeElement!.querySelector<HTMLAnchorElement>(`a[href="${destination}"]`)!.click();
    await stable(harness);
    expect(TestBed.inject(Router).url).toBe(destination);
    if (destination === '/dashboard') {
      http.expectOne('/api/v1/dashboard').flush({ total_expenses: '0.00', expenses_count: 0, expenses_by_category: [] });
    } else {
      http.expectOne('/api/v1/categories').flush([]);
      http.expectOne('/api/v1/households').flush([]);
      if (destination === '/gastos') http.expectOne('/api/v1/expenses').flush([]);
    }
  });

  it('shows a profile error without inventing a name or losing quick navigation', async () => {
    const harness = await RouterTestingHarness.create('/inicio');
    http.expectOne('/api/v1/profile').error(new ProgressEvent('error')); await stable(harness);
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')!.textContent).toContain('No se pudo cargar tu perfil');
    expect(harness.routeNativeElement!.querySelector('h1')!.textContent).toContain('Bienvenido/a a GastoHogar');
    expect(harness.routeNativeElement!.querySelectorAll('.quick-card')).toHaveLength(3);
  });
});
