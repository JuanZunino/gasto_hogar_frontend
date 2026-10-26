import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { ExpensesService } from './expenses.service';

describe('Expense filters', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    sessionStorage.setItem('gastohogar.token', 'test-token');
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); sessionStorage.clear(); });

  async function open(url = '/gastos') {
    const harness = await RouterTestingHarness.create(url);
    http.expectOne('/api/v1/categories').flush([{ id: 2, name: 'Alimentos', description: null }]);
    http.expectOne('/api/v1/households').flush([{ id: 3, name: 'Casa', description: null }]);
    harness.detectChanges();
    return harness;
  }
  function set(harness: RouterTestingHarness, id: string, value: string) {
    const control = harness.routeNativeElement!.querySelector<HTMLInputElement | HTMLSelectElement>('#' + id)!;
    control.value = value;
    control.dispatchEvent(new Event(control.tagName === 'SELECT' ? 'change' : 'input'));
  }
  async function apply(harness: RouterTestingHarness) {
    harness.routeNativeElement!.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await harness.fixture.whenStable(); harness.detectChanges();
  }

  it('only builds selected API parameters and omits empty values', () => {
    TestBed.inject(ExpensesService).list({ from: '2026-10-01', to: '', category_id: '2', household_id: '3' }).subscribe();
    const request = http.expectOne(req => req.url === '/api/v1/expenses');
    expect(request.request.params.keys()).toEqual(['from', 'category_id', 'household_id']);
    expect(request.request.params.get('from')).toBe('2026-10-01');
    expect(request.request.params.get('category_id')).toBe('2');
    expect(request.request.params.get('household_id')).toBe('3');
    request.flush([]);
  });

  it('applies all filters, persists the URL, distinguishes empty results and clears to the full list', async () => {
    const harness = await open();
    http.expectOne('/api/v1/expenses').flush([]);
    set(harness, 'from', '2026-10-01'); set(harness, 'to', '2026-10-23');
    set(harness, 'category', '2'); set(harness, 'household', '3');
    await apply(harness);
    const request = http.expectOne(req => req.url === '/api/v1/expenses');
    expect(request.request.params.get('from')).toBe('2026-10-01');
    expect(request.request.params.get('to')).toBe('2026-10-23');
    expect(request.request.params.get('category_id')).toBe('2');
    expect(request.request.params.get('household_id')).toBe('3');
    expect(TestBed.inject(Router).url).toContain('household_id=3');
    request.flush([]);
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('No hay resultados para los filtros');
    [...harness.routeNativeElement!.querySelectorAll('button')].find(button => button.textContent === 'Limpiar filtros')!.click();
    await harness.fixture.whenStable();
    http.expectOne('/api/v1/expenses').flush([]);
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/gastos');
    expect(harness.routeNativeElement!.textContent).toContain('Todavía no tenés gastos');
    expect(harness.routeNativeElement!.querySelector<HTMLInputElement>('#from')!.value).toBe('');
  });

  it('blocks reversed dates without changing the list or URL', async () => {
    const harness = await open(); http.expectOne('/api/v1/expenses').flush([]);
    set(harness, 'from', '2026-10-23'); set(harness, 'to', '2026-10-01');
    await apply(harness);
    http.expectNone(req => req.url === '/api/v1/expenses');
    expect(harness.routeNativeElement!.textContent).toContain('no puede ser posterior');
    expect(TestBed.inject(Router).url).toBe('/gastos');
  });

  it('restores filters from the URL, reports API errors and retries with the applied values', async () => {
    const harness = await open('/gastos?category_id=2&from=2026-10-01');
    const request = http.expectOne(req => req.url === '/api/v1/expenses' && req.params.get('category_id') === '2');
    request.flush({ error: 'No disponible' }, { status: 500, statusText: 'Server Error' });
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('No disponible');
    expect(harness.routeNativeElement!.querySelector<HTMLInputElement>('#from')!.value).toBe('2026-10-01');
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('.retry-list')!.click();
    http.expectOne(req => req.url === '/api/v1/expenses' && req.params.get('from') === '2026-10-01').flush([]);
  });

  it('rejects malformed or reversed URL dates before requesting expenses', async () => {
    const harness = await open('/gastos?from=2026-02-30');
    http.expectNone(req => req.url === '/api/v1/expenses');
    expect(harness.routeNativeElement!.textContent).toContain('Ingresá fechas válidas');
    [...harness.routeNativeElement!.querySelectorAll('button')].find(button => button.textContent === 'Limpiar filtros')!.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/gastos');
    http.expectOne('/api/v1/expenses').flush([]);
  });

  it('shows option errors and retries the real endpoints', async () => {
    const harness = await RouterTestingHarness.create('/gastos');
    http.expectOne('/api/v1/expenses').flush([]);
    http.expectOne('/api/v1/households').flush([]);
    http.expectOne('/api/v1/categories').flush({ errors: ['Categorías no disponibles'] }, { status: 503, statusText: 'Unavailable' });
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Categorías no disponibles');
    [...harness.routeNativeElement!.querySelectorAll('button')].find(button => button.textContent === 'Reintentar opciones')!.click();
    http.expectOne('/api/v1/categories').flush([]);
    http.expectOne('/api/v1/households').flush([]);
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).not.toContain('Categorías no disponibles');
  });
  it('keeps applied filters and success after deleting a filtered expense', async () => {
    const harness = await open('/gastos?household_id=3');
    http.expectOne(req => req.url === '/api/v1/expenses' && req.params.get('household_id') === '3').flush([{
      id: 10, description: 'Compra', amount: '10.00', date: '2026-10-23', notes: null,
      receipt_attached: false, category: { id: 2, name: 'Alimentos' }, household: { id: 3, name: 'Casa' },
      author: { id: 1, name: 'Ana' }, can_edit: true, can_delete: true,
    }]);
    await harness.fixture.whenStable(); harness.detectChanges();
    const click = (text: string) => {
      [...harness.routeNativeElement!.querySelectorAll('button')].find(button => button.textContent?.trim() === text)!.click();
      harness.detectChanges();
    };
    click('Eliminar'); click('Confirmar eliminación');
    http.expectOne('/api/v1/expenses/10').flush(null, { status: 204, statusText: 'No Content' });
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/gastos?household_id=3');
    expect(harness.routeNativeElement!.textContent).toContain('eliminado correctamente');
    expect(harness.routeNativeElement!.textContent).toContain('No hay resultados para los filtros');
    harness.routeNativeElement!.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    http.expectOne(req => req.url === '/api/v1/expenses' && req.params.get('household_id') === '3').flush([]);
  });

  it('cancels stale requests and follows query parameter navigation', async () => {
    const harness = await open('/gastos?category_id=2');
    const previous = http.expectOne(req => req.url === '/api/v1/expenses');
    await harness.navigateByUrl('/gastos?household_id=3');
    expect(previous.cancelled).toBe(true);
    const current = http.expectOne(req => req.url === '/api/v1/expenses');
    expect(current.request.params.keys()).toEqual(['household_id']);
    current.flush([]);
  });

  it('clears shared expenses after household access is revoked and returns to Mis gastos without logout', async () => {
    const harness = await open('/gastos?household_id=3');
    http.expectOne(req => req.url === '/api/v1/expenses' && req.params.get('household_id') === '3').flush([{
      id: 10, description: 'Compra compartida', amount: '10.00', date: '2026-10-23', notes: null,
      receipt_attached: false, category: { id: 2, name: 'Alimentos' }, household: { id: 3, name: 'Casa' },
      author: { id: 2, name: 'Bruno' }, can_edit: false, can_delete: false,
    }]);
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Compra compartida');
    await apply(harness);
    http.expectOne(req => req.url === '/api/v1/expenses' && req.params.get('household_id') === '3')
      .flush({ errors: ['Hogar no encontrado.'] }, { status: 404, statusText: 'Not Found' });
    await harness.fixture.whenStable(); harness.detectChanges();
    const element = harness.routeNativeElement!;
    expect(element.querySelector('[role="alert"]')!.textContent).toContain('Hogar no encontrado.');
    expect(element.querySelector('article')).toBeNull();
    expect(element.textContent).not.toContain('Compra compartida');
    expect(element.textContent).not.toContain('Bruno');
    expect(element.querySelector('.success')).toBeNull();
    expect(sessionStorage.getItem('gastohogar.token')).toBe('test-token');
    expect(TestBed.inject(Router).url).toBe('/gastos?household_id=3');
    expect(element.querySelector('#household option[value=""]')!.textContent).toBe('Mis gastos');
    [...element.querySelectorAll('button')].find(button => button.textContent === 'Limpiar filtros')!.click();
    await harness.fixture.whenStable();
    const request = http.expectOne('/api/v1/expenses');
    expect(request.request.params.has('household_id')).toBe(false);
    request.flush([]);
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/gastos');
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

});
