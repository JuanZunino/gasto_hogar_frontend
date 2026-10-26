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
const households = [{ id: 1, name: 'Casa', description: null }, { id: 2, name: 'Departamento', description: null }];
const shared: DashboardSummary = {
  total_expenses: '123.45', expenses_count: 7,
  expenses_by_category: [{ category: { id: 3, name: 'Alimentos' }, total: '123.45' }],
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
  async function createDashboard(url = '/dashboard', options = households) {
    const harness = await RouterTestingHarness.create(url);
    const request = http.expectOne('/api/v1/households');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush(options);
    await stable(harness);
    return harness;
  }
  function householdSelect(harness: RouterTestingHarness) {
    return harness.routeNativeElement!.querySelector<HTMLSelectElement>('#dashboard-household')!;
  }
  async function selectHousehold(harness: RouterTestingHarness, value: string) {
    const select = householdSelect(harness);
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await stable(harness);
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
    const harness = await createDashboard('/dashboard');
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
    expect(harness.routeNativeElement!.querySelector('.total-card app-dashboard-icon')!.getAttribute('name')).toBe('wallet');
    expect(harness.routeNativeElement!.querySelector('.count-card app-dashboard-icon')!.getAttribute('name')).toBe('receipt');
    const legend = harness.routeNativeElement!.querySelector('app-category-donut ul')!;
    expect(legend.textContent).toContain('Alimentos');
    expect(legend.textContent).toContain('$\u00a09.007.199.254.740.993,00');
    expect(legend.textContent).toContain('<0,1 %');
    expect(harness.routeNativeElement!.querySelector('app-category-donut svg')!.getAttribute('aria-hidden')).toBe('true');
    const rows = harness.routeNativeElement!.querySelectorAll('app-category-chart .bars li');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Alimentos');
    expect(rows[0].textContent).toContain('$\u00a09.007.199.254.740.993,00');
    expect(rows[1].textContent).toContain('Servicios');
    expect(rows[1].textContent).toContain('$\u00a00,01');
    expect(harness.routeNativeElement!.querySelector('.track')!.getAttribute('aria-hidden')).toBe('true');
    expect(harness.routeNativeElement!.querySelector('label[for="dashboard-from"]')!.textContent).toBe('Desde');
    expect(harness.routeNativeElement!.querySelector('label[for="dashboard-to"]')!.textContent).toBe('Hasta');
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

  it('requests the personal summary without household_id and preserves the response structure', () => {
    TestBed.inject(DashboardService).get().subscribe(result => expect(result).toEqual(summary));
    const request = http.expectOne('/api/v1/dashboard');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush(summary);
  });

  it('requests the shared summary with a valid household_id and unchanged JSON structure', () => {
    TestBed.inject(DashboardService).get({ household_id: '1' }).subscribe(result => expect(result).toEqual(shared));
    const request = http.expectOne('/api/v1/dashboard?household_id=1');
    expect(request.request.params.keys()).toEqual(['household_id']);
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush(shared);
  });

  it('combines household_id and dates without category_id', () => {
    TestBed.inject(DashboardService).get({ household_id: '2', from: '2026-10-01', to: '2026-10-31' }).subscribe();
    const request = http.expectOne(req => req.url === '/api/v1/dashboard');
    expect(request.request.params.keys()).toEqual(['from', 'to', 'household_id']);
    expect(request.request.params.get('from')).toBe('2026-10-01');
    expect(request.request.params.get('to')).toBe('2026-10-31');
    expect(request.request.params.get('household_id')).toBe('2');
    expect(request.request.params.has('category_id')).toBe(false);
    request.flush(shared);
  });

  it.each(['', '0', '-1', '1.5', 'abc', ' 1', '1 ', '01'])(
    'omits empty or invalid household_id %j while retaining dates', householdId => {
      TestBed.inject(DashboardService).get({ household_id: householdId, from: '2026-10-01' }).subscribe();
      const request = http.expectOne('/api/v1/dashboard?from=2026-10-01');
      expect(request.request.params.keys()).toEqual(['from']);
      request.flush(summary);
    },
  );

  it('starts with Mis gastos, loads only API households and avoids a duplicate personal request', async () => {
    const harness = await RouterTestingHarness.create('/dashboard');
    expect(householdSelect(harness).value).toBe('');
    expect(householdSelect(harness).disabled).toBe(true);
    expect(harness.routeNativeElement!.textContent).toContain('Cargando hogares');
    http.expectOne('/api/v1/dashboard').flush(summary);
    http.expectOne('/api/v1/households').flush(households);
    await stable(harness);
    const select = householdSelect(harness);
    expect(select.disabled).toBe(false);
    expect(select.value).toBe('');
    expect([...select.options].map(option => [option.value, option.textContent?.trim()]))
      .toEqual([['', 'Mis gastos'], ['1', 'Casa'], ['2', 'Departamento']]);
    expect(select.labels![0].textContent).toBe('Hogar');
    expect(harness.routeNativeElement!.textContent).toContain('Resumen de tus gastos propios accesibles.');
    http.expectNone(req => req.url === '/api/v1/dashboard');
  });

  it('keeps only Mis gastos when the API returns no households', async () => {
    const harness = await createDashboard('/dashboard', []);
    http.expectOne('/api/v1/dashboard').flush(empty); await stable(harness);
    expect([...householdSelect(harness).options].map(option => option.value)).toEqual(['']);
    expect(householdSelect(harness).value).toBe('');
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows household loading errors, retains personal statistics and retries options only', async () => {
    const harness = await RouterTestingHarness.create('/dashboard');
    http.expectOne('/api/v1/dashboard').flush(summary);
    http.expectOne('/api/v1/households').error(new ProgressEvent('error'));
    await stable(harness);
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')!.textContent).toContain('No se pudieron cargar los hogares');
    expect(harness.routeNativeElement!.querySelector('.total-card dd')!.textContent).toContain('9.007.199.254.740.993,01');
    click(harness, 'Reintentar hogares');
    http.expectOne('/api/v1/households').flush(households); await stable(harness);
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')).toBeNull();
    expect(householdSelect(harness).options).toHaveLength(3);
    http.expectNone(req => req.url === '/api/v1/dashboard');
  });

  it('offers Mis gastos with dates when households cannot be loaded for a saved household URL', async () => {
    const harness = await RouterTestingHarness.create('/dashboard?household_id=1&from=2026-10-01');
    http.expectNone(req => req.url === '/api/v1/dashboard');
    http.expectOne('/api/v1/households').flush({ errors: ['Hogares no disponibles'] }, { status: 503, statusText: 'Unavailable' });
    await stable(harness);
    expect(harness.routeNativeElement!.textContent).toContain('Hogares no disponibles');
    expect(harness.routeNativeElement!.querySelector('.cards')).toBeNull();
    click(harness, 'Ver Mis gastos'); await stable(harness);
    const request = http.expectOne('/api/v1/dashboard?from=2026-10-01');
    expect(request.request.params.has('household_id')).toBe(false);
    request.flush(summary); await stable(harness);
    expect(TestBed.inject(Router).url).toBe('/dashboard?from=2026-10-01');
    expect(sessionStorage.getItem('gastohogar.token')).toBe('test-token');
  });

  it('switches household and personal summaries while preserving dates and displaying API aggregates', async () => {
    const harness = await createDashboard('/dashboard?from=2026-10-01&to=2026-10-31');
    http.expectOne(req => req.url === '/api/v1/dashboard').flush(summary); await stable(harness);
    await selectHousehold(harness, '1');
    expect(harness.routeNativeElement!.querySelector('.cards')).toBeNull();
    const request = http.expectOne(req => req.url === '/api/v1/dashboard');
    expect(request.request.params.get('household_id')).toBe('1');
    expect(request.request.params.get('from')).toBe('2026-10-01');
    expect(request.request.params.get('to')).toBe('2026-10-31');
    expect(TestBed.inject(Router).url).toBe('/dashboard?from=2026-10-01&to=2026-10-31&household_id=1');
    request.flush(shared); await stable(harness);
    expect(harness.routeNativeElement!.querySelector('.total-card dd')!.textContent).toBe('$\u00a0123,45');
    expect(harness.routeNativeElement!.querySelector('.count-card dd')!.textContent).toBe('7');
    expect(harness.routeNativeElement!.querySelectorAll('.bars li')).toHaveLength(1);
    expect(harness.routeNativeElement!.querySelector('app-category-donut strong')!.textContent).toBe('$\u00a0123,45');
    expect(harness.routeNativeElement!.textContent).toContain('Resumen conjunto de Casa.');
    await selectHousehold(harness, '');
    const personal = http.expectOne(req => req.url === '/api/v1/dashboard');
    expect(personal.request.params.keys()).toEqual(['from', 'to']);
    personal.flush(summary); await stable(harness);
    expect(TestBed.inject(Router).url).toBe('/dashboard?from=2026-10-01&to=2026-10-31');
    expect(harness.routeNativeElement!.textContent).toContain('Resumen de tus gastos propios accesibles.');
    expect(householdSelect(harness).value).toBe('');
  });

  it('restores the authorized household, preserves it on date changes and follows URL history', async () => {
    const harness = await createDashboard('/dashboard?household_id=1&from=2026-10-01');
    http.expectOne(req => req.url === '/api/v1/dashboard').flush(shared); await stable(harness);
    expect(householdSelect(harness).value).toBe('1');
    set(harness, 'to', '2026-10-31'); await apply(harness);
    const request = http.expectOne(req => req.url === '/api/v1/dashboard');
    expect(request.request.params.get('household_id')).toBe('1');
    expect(request.request.params.get('from')).toBe('2026-10-01');
    expect(request.request.params.get('to')).toBe('2026-10-31');
    request.flush(shared); await stable(harness);
    await harness.navigateByUrl('/dashboard?household_id=2&to=2026-10-31');
    const next = http.expectOne(req => req.url === '/api/v1/dashboard');
    expect(next.request.params.get('household_id')).toBe('2');
    expect(next.request.params.has('from')).toBe(false);
    next.flush(empty); await stable(harness);
    expect(householdSelect(harness).value).toBe('2');
    await harness.navigateByUrl('/dashboard?household_id=1&from=2026-10-01');
    http.expectOne(req => req.url === '/api/v1/dashboard' && req.params.get('household_id') === '1').flush(shared);
    await stable(harness);
    expect(householdSelect(harness).value).toBe('1');
    expect(harness.routeNativeElement!.querySelector<HTMLInputElement>('#dashboard-to')!.value).toBe('');
    http.expectNone('/api/v1/households');
  });

  it.each(['99', '-1', 'abc'])(
    'removes unavailable household %s from the URL without querying its dashboard', async householdId => {
      const harness = await RouterTestingHarness.create(`/dashboard?household_id=${householdId}&from=2026-10-01`);
      http.expectNone(req => req.url === '/api/v1/dashboard');
      http.expectOne('/api/v1/households').flush(households); await stable(harness);
      const request = http.expectOne('/api/v1/dashboard?from=2026-10-01');
      expect(request.request.params.has('household_id')).toBe(false);
      request.flush(summary); await stable(harness);
      expect(TestBed.inject(Router).url).toBe('/dashboard?from=2026-10-01');
      expect(householdSelect(harness).value).toBe('');
      expect(harness.routeNativeElement!.textContent).toContain('El hogar ya no está disponible.');
      http.expectNone(req => req.url === '/api/v1/dashboard');
    },
  );

  it('clears statistics on household 404, preserves session, retries the applied filters and returns to Mis gastos', async () => {
    const harness = await createDashboard('/dashboard?household_id=1&from=2026-10-01');
    http.expectOne(req => req.url === '/api/v1/dashboard').flush(shared); await stable(harness);
    await apply(harness);
    http.expectOne(req => req.url === '/api/v1/dashboard').flush({ errors: ['Hogar no encontrado.'] }, { status: 404, statusText: 'Not Found' });
    await stable(harness);
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')!.textContent).toContain('Hogar no encontrado.');
    expect(harness.routeNativeElement!.querySelector('.cards')).toBeNull();
    expect(harness.routeNativeElement!.querySelector('app-category-chart')).toBeNull();
    expect(harness.routeNativeElement!.textContent).not.toContain('$\u00a0123,45');
    expect(sessionStorage.getItem('gastohogar.token')).toBe('test-token');
    expect(TestBed.inject(Router).url).toContain('/dashboard?');
    set(harness, 'from', '2026-09-01');
    click(harness, 'Reintentar');
    const retry = http.expectOne(req => req.url === '/api/v1/dashboard');
    expect(retry.request.params.get('household_id')).toBe('1');
    expect(retry.request.params.get('from')).toBe('2026-10-01');
    retry.flush({ errors: ['Hogar no encontrado.'] }, { status: 404, statusText: 'Not Found' }); await stable(harness);
    set(harness, 'from', '2026-10-01');
    await selectHousehold(harness, '');
    http.expectOne('/api/v1/dashboard?from=2026-10-01').flush(summary); await stable(harness);
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')).toBeNull();
    expect(harness.routeNativeElement!.textContent).toContain('Resumen de tus gastos propios accesibles.');
  });

  it('keeps the selected household and dates when refreshed options still contain it', async () => {
    const harness = await createDashboard('/dashboard?household_id=1&from=2026-10-01');
    http.expectOne(req => req.url === '/api/v1/dashboard').flush(shared); await stable(harness);
    click(harness, 'Actualizar hogares');
    expect(harness.routeNativeElement!.querySelector('.cards')).toBeNull();
    http.expectNone(req => req.url === '/api/v1/dashboard');
    http.expectOne('/api/v1/households').flush(households); await stable(harness);
    const request = http.expectOne(req => req.url === '/api/v1/dashboard');
    expect(request.request.params.get('household_id')).toBe('1');
    expect(request.request.params.get('from')).toBe('2026-10-01');
    request.flush(shared); await stable(harness);
    expect(householdSelect(harness).value).toBe('1');
    expect(harness.routeNativeElement!.textContent).toContain('Resumen conjunto de Casa.');
    http.expectNone(req => req.url === '/api/v1/dashboard');
  });

  it('drops a revoked household and its statistics on refresh, preserving dates for Mis gastos', async () => {
    const harness = await createDashboard('/dashboard?household_id=1&from=2026-10-01&to=2026-10-31');
    http.expectOne(req => req.url === '/api/v1/dashboard').flush(shared); await stable(harness);
    click(harness, 'Actualizar hogares');
    expect(harness.routeNativeElement!.querySelector('.cards')).toBeNull();
    http.expectOne('/api/v1/households').flush([households[1]]); await stable(harness);
    const request = http.expectOne('/api/v1/dashboard?from=2026-10-01&to=2026-10-31');
    expect(request.request.params.has('household_id')).toBe(false);
    request.flush(summary); await stable(harness);
    expect(householdSelect(harness).value).toBe('');
    expect([...householdSelect(harness).options].map(option => option.value)).toEqual(['', '2']);
    expect(TestBed.inject(Router).url).toBe('/dashboard?from=2026-10-01&to=2026-10-31');
    expect(harness.routeNativeElement!.textContent).not.toContain('$\u00a0123,45');
    expect(sessionStorage.getItem('gastohogar.token')).toBe('test-token');
    http.expectNone(req => req.url === '/api/v1/dashboard');
  });

  it('cancels an older household query so its late response cannot overwrite the newer summary', async () => {
    const harness = await createDashboard('/dashboard');
    http.expectOne('/api/v1/dashboard').flush(summary); await stable(harness);
    await selectHousehold(harness, '1');
    const older = http.expectOne(req => req.url === '/api/v1/dashboard' && req.params.get('household_id') === '1');
    await selectHousehold(harness, '2');
    expect(older.cancelled).toBe(true);
    expect(harness.routeNativeElement!.querySelector('.cards')).toBeNull();
    const newer = http.expectOne(req => req.url === '/api/v1/dashboard' && req.params.get('household_id') === '2');
    newer.flush(shared); await stable(harness);
    expect(() => older.flush(summary)).toThrowError(/cancelled/i);
    await stable(harness);
    expect(harness.routeNativeElement!.querySelector('.total-card dd')!.textContent).toBe('$\u00a0123,45');
    expect(harness.routeNativeElement!.textContent).toContain('Resumen conjunto de Departamento.');
    expect(householdSelect(harness).value).toBe('2');
  });

  it('shows the household empty state without inventing chart categories', async () => {
    const harness = await createDashboard('/dashboard?household_id=1');
    http.expectOne('/api/v1/dashboard?household_id=1').flush(empty); await stable(harness);
    expect(harness.routeNativeElement!.textContent).toContain('No hay gastos registrados en este hogar.');
    expect(harness.routeNativeElement!.querySelector('.total-card dd')!.textContent).toBe('$\u00a00,00');
    expect(harness.routeNativeElement!.querySelector('app-category-chart')).toBeNull();
  });

  it('applies dates only on submit, persists them in the URL and clears to an unfiltered summary', async () => {
    const harness = await createDashboard('/dashboard');
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
    expect(harness.routeNativeElement!.textContent).toContain('Resumen de tus gastos propios accesibles.');
  });

  it('blocks an inverted range, focuses its control and retains the loaded summary', async () => {
    const harness = await createDashboard('/dashboard');
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
      const harness = await createDashboard('/dashboard?' + query);
      http.expectNone(req => req.url === '/api/v1/dashboard');
      expect(harness.routeNativeElement!.querySelector('[role="alert"]')).not.toBeNull();
      click(harness, 'Limpiar filtros'); await stable(harness);
      http.expectOne('/api/v1/dashboard').flush(empty);
      expect(TestBed.inject(Router).url).toBe('/dashboard');
    },
  );

  it('loads an authorized household and saved period while ignoring category_id', async () => {
    const harness = await createDashboard('/dashboard?from=2026-02-28&to=2026-03-01&category_id=5&household_id=1');
    const request = http.expectOne(req => req.url === '/api/v1/dashboard');
    expect(request.request.params.keys()).toEqual(['from', 'to', 'household_id']);
    expect(request.request.params.get('household_id')).toBe('1');
    expect(request.request.params.has('category_id')).toBe(false);
    expect(request.request.params.get('from')).toBe('2026-02-28');
    expect(request.request.params.get('to')).toBe('2026-03-01');
    request.flush(summary); await stable(harness);
    expect(harness.routeNativeElement!.querySelector<HTMLInputElement>('#dashboard-from')!.value).toBe('2026-02-28');
    expect(harness.routeNativeElement!.querySelector<HTMLInputElement>('#dashboard-to')!.value).toBe('2026-03-01');
  });

  it('shows zero totals and an empty state without inventing categories', async () => {
    const harness = await createDashboard('/dashboard');
    http.expectOne('/api/v1/dashboard').flush(empty); await stable(harness);
    expect(harness.routeNativeElement!.textContent).toContain('Todavía no tenés gastos registrados.');
    expect(harness.routeNativeElement!.querySelectorAll('dd')[0].textContent).toBe('$\u00a00,00');
    expect(harness.routeNativeElement!.querySelectorAll('dd')[1].textContent).toBe('0');
    expect(harness.routeNativeElement!.querySelector('app-category-chart')).toBeNull();
    expect(harness.routeNativeElement!.querySelector('app-category-donut')).toBeNull();
  });

  it.each([{ error: 'Resumen no disponible' }, { errors: ['Resumen no disponible'] }])(
    'shows API errors and retries the applied period rather than draft dates', async body => {
      const harness = await createDashboard('/dashboard?from=2026-10-01');
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
    const harness = await createDashboard('/dashboard');
    http.expectOne('/api/v1/dashboard').error(new ProgressEvent('error')); await stable(harness);
    expect(harness.routeNativeElement!.textContent).toContain('Verificá tu conexión');
  });

  it('cancels stale requests on period navigation and on leaving the dashboard', async () => {
    const harness = await createDashboard('/dashboard?from=2026-10-01');
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

  it('preserves API loading when navigating from home to dashboard and expenses', async () => {
    const harness = await RouterTestingHarness.create('/inicio');
    http.expectOne('/api/v1/profile').flush({ id: 7, name: 'Usuario real', email: 'usuario@example.com', role: 'member' });
    await stable(harness);
    await TestBed.inject(Router).navigateByUrl('/dashboard');
    await stable(harness);
    expect(TestBed.inject(Router).url).toBe('/dashboard');
    http.expectOne('/api/v1/households').flush(households);
    http.expectOne('/api/v1/dashboard').flush(empty); await stable(harness);
    await TestBed.inject(Router).navigateByUrl('/gastos');
    await stable(harness);
    expect(TestBed.inject(Router).url).toBe('/gastos');
    http.expectOne('/api/v1/categories').flush([]);
    http.expectOne('/api/v1/households').flush([]);
    http.expectOne('/api/v1/expenses').flush([]);
  });
});
