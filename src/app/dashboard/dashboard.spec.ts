import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { authInterceptor } from '../auth/auth.interceptor';
import { DashboardService, DashboardSummary } from './dashboard.service';

const summary: DashboardSummary = {
  total_expenses: '9007199254740993.01', expenses_count: 3,
  expenses_by_category: [
    { category: { id: 1, name: 'Alimentos' }, total: '9007199254740993.00' },
    { category: { id: 2, name: 'Servicios' }, total: '0.01' },
  ],
};
const empty: DashboardSummary = { total_expenses: '0.00', expenses_count: 0, expenses_by_category: [] };

describe('Dashboard', () => {
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
    await harness.fixture.whenStable();
    harness.detectChanges();
  }
  function set(harness: RouterTestingHarness, field: 'from' | 'to', value: string) {
    const input = harness.routeNativeElement!.querySelector<HTMLInputElement>('#dashboard-' + field)!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    harness.detectChanges();
  }
  async function apply(harness: RouterTestingHarness) {
    harness.routeNativeElement!.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await stable(harness);
  }
  function click(harness: RouterTestingHarness, text: string) {
    const button = [...harness.routeNativeElement!.querySelectorAll('button')]
      .find(button => button.textContent?.trim() === text);
    expect(button).toBeDefined();
    button!.click();
    harness.detectChanges();
  }

  it('requests the authenticated API and renders exact ARS totals, count and accessible category labels', async () => {
    const harness = await RouterTestingHarness.create('/dashboard');
    expect(harness.routeNativeElement!.textContent).toContain('Cargando resumen');
    const request = http.expectOne('/api/v1/dashboard');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush(summary);
    await stable(harness);
    const text = harness.routeNativeElement!.textContent!;
    expect(text).toContain('$\u00a09.007.199.254.740.993,01');
    const cards = harness.routeNativeElement!.querySelectorAll('dd');
    expect(cards[1].textContent).toBe('3');
    const rows = harness.routeNativeElement!.querySelectorAll('app-category-chart li');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Alimentos');
    expect(rows[0].textContent).toContain('$\u00a09.007.199.254.740.993,00');
    expect(rows[1].textContent).toContain('Servicios');
    expect(rows[1].textContent).toContain('$\u00a00,01');
    expect(harness.routeNativeElement!.querySelector('.track')!.getAttribute('aria-hidden')).toBe('true');
    expect(harness.routeNativeElement!.querySelector('label[for="dashboard-from"]')!.textContent).toBe('Desde');
    expect(harness.routeNativeElement!.querySelector('label[for="dashboard-to"]')!.textContent).toBe('Hasta');
    expect(harness.routeNativeElement!.querySelector('a[href="/gastos"]')).not.toBeNull();
  });

  it('only constructs from/to parameters, omits empty filters and preserves response decimals', () => {
    const service = TestBed.inject(DashboardService);
    service.get({ from: '2026-10-01', to: '' }).subscribe(result => expect(result).toEqual(summary));
    const request = http.expectOne(req => req.url === '/api/v1/dashboard');
    expect(request.request.params.keys()).toEqual(['from']);
    expect(request.request.params.get('from')).toBe('2026-10-01');
    request.flush(summary);
    service.get({ to: '2026-10-23' }).subscribe();
    const to = http.expectOne(req => req.url === '/api/v1/dashboard');
    expect(to.request.params.keys()).toEqual(['to']);
    expect(to.request.params.get('to')).toBe('2026-10-23');
    to.flush(empty);
  });

  it('applies dates only on submit, persists them in the URL and clears to an unfiltered summary', async () => {
    const harness = await RouterTestingHarness.create('/dashboard');
    http.expectOne('/api/v1/dashboard').flush(summary);
    await stable(harness);
    set(harness, 'from', '2026-10-01'); set(harness, 'to', '2026-10-23');
    http.expectNone(req => req.url === '/api/v1/dashboard');
    await apply(harness);
    const request = http.expectOne(req => req.url === '/api/v1/dashboard');
    expect(request.request.params.keys()).toEqual(['from', 'to']);
    expect(request.request.params.get('from')).toBe('2026-10-01');
    expect(request.request.params.get('to')).toBe('2026-10-23');
    expect(TestBed.inject(Router).url).toBe('/dashboard?from=2026-10-01&to=2026-10-23');
    request.flush(empty); await stable(harness);
    expect(harness.routeNativeElement!.textContent).toContain('No hay gastos para el período seleccionado.');
    click(harness, 'Limpiar filtros'); await stable(harness);
    http.expectOne('/api/v1/dashboard').flush(summary);
    await stable(harness);
    expect(TestBed.inject(Router).url).toBe('/dashboard');
    expect(harness.routeNativeElement!.querySelector<HTMLInputElement>('#dashboard-from')!.value).toBe('');
    expect(harness.routeNativeElement!.querySelector<HTMLInputElement>('#dashboard-to')!.value).toBe('');
    expect(harness.routeNativeElement!.textContent).toContain('Resumen de todos tus gastos.');
  });

  it('blocks an inverted range, focuses its control and retains the loaded summary', async () => {
    const harness = await RouterTestingHarness.create('/dashboard');
    http.expectOne('/api/v1/dashboard').flush(summary); await stable(harness);
    set(harness, 'from', '2026-10-23'); set(harness, 'to', '2026-10-01');
    await apply(harness);
    http.expectNone(req => req.url === '/api/v1/dashboard');
    expect(harness.routeNativeElement!.textContent).toContain('La fecha desde no puede ser posterior');
    expect(harness.routeNativeElement!.textContent).toContain('$\u00a09.007.199.254.740.993,01');
    expect(harness.routeNativeElement!.querySelector<HTMLInputElement>('#dashboard-from')!.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement?.id).toBe('dashboard-from');
    expect(TestBed.inject(Router).url).toBe('/dashboard');
  });

  it.each(['from=2026-02-30', 'to=not-a-date', 'from=0000-01-01', 'from=2026-10-23&to=2026-10-01'])(
    'rejects invalid URL dates (%s) and can clear them', async query => {
      const harness = await RouterTestingHarness.create('/dashboard?' + query);
      http.expectNone(req => req.url === '/api/v1/dashboard');
      expect(harness.routeNativeElement!.querySelector('[role="alert"]')).not.toBeNull();
      click(harness, 'Limpiar filtros'); await stable(harness);
      http.expectOne('/api/v1/dashboard').flush(empty);
      expect(TestBed.inject(Router).url).toBe('/dashboard');
    },
  );

  it('loads a saved period and ignores unsupported query parameters', async () => {
    const harness = await RouterTestingHarness.create('/dashboard?from=2026-02-28&to=2026-03-01&category_id=5&household_id=1');
    const request = http.expectOne(req => req.url === '/api/v1/dashboard');
    expect(request.request.params.keys()).toEqual(['from', 'to']);
    expect(request.request.params.get('from')).toBe('2026-02-28');
    expect(request.request.params.get('to')).toBe('2026-03-01');
    request.flush(summary); await stable(harness);
    expect(harness.routeNativeElement!.querySelector<HTMLInputElement>('#dashboard-from')!.value).toBe('2026-02-28');
    expect(harness.routeNativeElement!.querySelector<HTMLInputElement>('#dashboard-to')!.value).toBe('2026-03-01');
  });

  it('shows zero totals and an empty state without inventing categories', async () => {
    const harness = await RouterTestingHarness.create('/dashboard');
    http.expectOne('/api/v1/dashboard').flush(empty); await stable(harness);
    expect(harness.routeNativeElement!.textContent).toContain('Todavía no tenés gastos registrados.');
    expect(harness.routeNativeElement!.querySelectorAll('dd')[0].textContent).toBe('$\u00a00,00');
    expect(harness.routeNativeElement!.querySelectorAll('dd')[1].textContent).toBe('0');
    expect(harness.routeNativeElement!.querySelector('app-category-chart')).toBeNull();
  });

  it.each([{ error: 'Resumen no disponible' }, { errors: ['Resumen no disponible'] }])(
    'shows API errors and retries the applied period rather than draft dates', async body => {
      const harness = await RouterTestingHarness.create('/dashboard?from=2026-10-01');
      http.expectOne(req => req.url === '/api/v1/dashboard').flush(body, { status: 503, statusText: 'Unavailable' });
      await stable(harness);
      expect(harness.routeNativeElement!.querySelector('[role="alert"]')!.textContent).toContain('Resumen no disponible');
      set(harness, 'from', '2026-09-01');
      click(harness, 'Reintentar');
      const request = http.expectOne(req => req.url === '/api/v1/dashboard');
      expect(request.request.params.get('from')).toBe('2026-10-01');
      expect(harness.routeNativeElement!.textContent).toContain('Cargando resumen');
      request.flush(summary); await stable(harness);
      expect(harness.routeNativeElement!.querySelector('[role="alert"]')).toBeNull();
      expect(harness.routeNativeElement!.textContent).toContain('Alimentos');
    },
  );

  it('shows network errors with a useful fallback', async () => {
    const harness = await RouterTestingHarness.create('/dashboard');
    http.expectOne('/api/v1/dashboard').error(new ProgressEvent('error')); await stable(harness);
    expect(harness.routeNativeElement!.textContent).toContain('Verificá tu conexión');
  });

  it('cancels stale requests on period navigation and on leaving the dashboard', async () => {
    const harness = await RouterTestingHarness.create('/dashboard?from=2026-10-01');
    const previous = http.expectOne(req => req.url === '/api/v1/dashboard');
    await harness.navigateByUrl('/dashboard?to=2026-10-23');
    expect(previous.cancelled).toBe(true);
    const current = http.expectOne(req => req.url === '/api/v1/dashboard');
    expect(current.request.params.keys()).toEqual(['to']);
    await harness.navigateByUrl('/login');
    expect(current.cancelled).toBe(true);
  });

  it('protects the dashboard without a session', async () => {
    sessionStorage.clear();
    await RouterTestingHarness.create('/dashboard');
    expect(TestBed.inject(Router).url).toBe('/login');
    http.expectNone('/api/v1/dashboard');
  });

  it('navigates from home to dashboard and back to expenses', async () => {
    const harness = await RouterTestingHarness.create('/inicio');
    http.expectOne('/api/v1/profile').flush({ id: 7, name: 'Usuario real', email: 'usuario@example.com', role: 'member' });
    await stable(harness);
    harness.routeNativeElement!.querySelector<HTMLAnchorElement>('a[href="/dashboard"]')!.click();
    await stable(harness);
    expect(TestBed.inject(Router).url).toBe('/dashboard');
    http.expectOne('/api/v1/dashboard').flush(empty); await stable(harness);
    harness.routeNativeElement!.querySelector<HTMLAnchorElement>('a[href="/gastos"]')!.click();
    await stable(harness);
    expect(TestBed.inject(Router).url).toBe('/gastos');
    http.expectOne('/api/v1/categories').flush([]);
    http.expectOne('/api/v1/households').flush([]);
    http.expectOne('/api/v1/expenses').flush([]);
  });
});
