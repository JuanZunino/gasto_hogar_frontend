import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from '../app';
import { routes } from '../app.routes';
import { AuthService, AuthUser } from '../auth/auth.service';
import { authInterceptor } from '../auth/auth.interceptor';

const user: AuthUser = { id: 7, name: 'Ana Pérez', email: 'ana@example.com', role: 'member' };
const empty = { total_expenses: '0.00', expenses_count: 0, expenses_by_category: [] };

describe('Shared application layout', () => {
  let http: HttpTestingController;
  let router: Router;
  let fixture: ComponentFixture<App>;
  let element: HTMLElement;

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('gastohogar.token', 'test-token');
    TestBed.configureTestingModule({ providers: [
      provideRouter(routes), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
    ] });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(App);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });
  afterEach(() => { http.verify(); sessionStorage.clear(); });

  async function stable() { await fixture.whenStable(); fixture.detectChanges(); }
  async function navigate(url: string) { await router.navigateByUrl(url); await stable(); }
  function menuButton() { return element.querySelector<HTMLButtonElement>('.menu-toggle')!; }
  function click(selector: string) {
    const control = element.querySelector<HTMLElement>(selector);
    expect(control).not.toBeNull();
    control!.click(); fixture.detectChanges();
  }
  function expenses() {
    http.expectOne('/api/v1/categories').flush([]);
    http.expectOne('/api/v1/households').flush([]);
    http.expectOne('/api/v1/expenses').flush([]);
  }

  it('keeps login outside the authenticated navigation and protects the existing routes', async () => {
    sessionStorage.clear();
    for (const url of ['/inicio', '/dashboard', '/gastos', '/gastos/nuevo', '/gastos/10/editar']) {
      await navigate(url);
      expect(router.url).toBe('/login');
      expect(element.querySelector('aside')).toBeNull();
      expect(element.querySelector('header')).toBeNull();
      expect(element.querySelectorAll('main')).toHaveLength(1);
      expect(element.querySelector('app-login')).not.toBeNull();
    }
    http.expectNone(request => request.url.startsWith('/api/v1/'));
  });

  it('provides only real destinations, highlights the route and avoids duplicate screen navigation', async () => {
    await navigate('/gastos'); expenses(); await stable();
    const links = element.querySelectorAll<HTMLAnchorElement>('nav a');
    expect([...links].map(link => link.getAttribute('href'))).toEqual(['/inicio', '/dashboard', '/gastos']);
    expect(element.querySelector('nav a[aria-current="page"]')!.textContent).toContain('Mis gastos');
    expect(element.querySelector('nav a.active')!.getAttribute('href')).toBe('/gastos');
    expect(element.querySelectorAll('nav')).toHaveLength(1);
    expect(element.querySelectorAll('h1')).toHaveLength(1);
    expect(element.querySelector('.brand')!.textContent).toContain('GastoHogar');
    expect(element.querySelector('app-expenses nav')).toBeNull();
    click('nav a[href="/dashboard"]'); await stable();
    http.expectOne('/api/v1/dashboard').flush(empty); await stable();
    expect(router.url).toBe('/dashboard');
    expect(element.querySelector('nav a[aria-current="page"]')!.textContent).toContain('Dashboard');
    expect(element.querySelectorAll('nav a.active')).toHaveLength(1);
    click('nav a[href="/inicio"]'); await stable();
    http.expectOne('/api/v1/profile').flush(user); await stable();
    expect(element.querySelector('nav a[aria-current="page"]')!.textContent).toContain('Inicio');
    expect(element.querySelectorAll('button.logout')).toHaveLength(1);
    expect(element.querySelector('app-home nav')).toBeNull();
  });

  it('keeps Mis gastos active during filters, creation and editing', async () => {
    await navigate('/gastos?from=2026-10-01');
    http.expectOne('/api/v1/categories').flush([]);
    http.expectOne('/api/v1/households').flush([]);
    http.expectOne(request => request.url === '/api/v1/expenses' && request.params.get('from') === '2026-10-01').flush([]);
    for (const url of ['/gastos/nuevo', '/gastos/10/editar']) {
      await navigate(url);
      http.expectOne('/api/v1/categories').flush([{ id: 2, name: 'Alimentos', description: null }]);
      http.expectOne('/api/v1/households').flush([]);
      if (url.endsWith('editar')) {
        http.expectOne('/api/v1/expenses/10').flush({ id: 10, description: 'Compra', amount: '20.00',
          date: '2026-10-01', category: { id: 2, name: 'Alimentos' }, household: null, notes: null });
      }
      await stable();
      expect(element.querySelector('nav a[aria-current="page"]')!.getAttribute('href')).toBe('/gastos');
      expect(element.querySelectorAll('nav a.active')).toHaveLength(1);
      expect(element.querySelectorAll('app-new-expense form.expense-form')).toHaveLength(1);
    }
  });

  it('opens and closes the mobile disclosure and restores focus with Escape', async () => {
    await navigate('/dashboard'); http.expectOne('/api/v1/dashboard').flush(empty); await stable();
    const button = menuButton();
    // jsdom does not apply viewport media queries; expose the control as mobile CSS does.
    button.style.display = 'inline-flex';
    expect(button.getAttribute('aria-controls')).toBe('primary-sidebar');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.textContent).toContain('Abrir menú');
    button.click(); fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.textContent).toContain('Cerrar menú');
    expect(element.querySelector('#primary-sidebar')!.classList.contains('menu-open')).toBe(true);
    element.querySelector<HTMLAnchorElement>('nav a')!.focus();
    element.querySelector('nav a')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
    button.click(); fixture.detectChanges();
    button.click(); fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes the menu after following a link and focuses the destination heading', async () => {
    await navigate('/dashboard'); http.expectOne('/api/v1/dashboard').flush(empty); await stable();
    menuButton().click(); fixture.detectChanges();
    click('nav a[href="/gastos"]'); await stable(); expenses(); await stable();
    expect(menuButton().getAttribute('aria-expanded')).toBe('false');
    expect(element.querySelector('#primary-sidebar')!.classList.contains('menu-open')).toBe(false);
    expect(document.activeElement).toBe(element.querySelector('h1'));
  });

  it('supports skipping navigation directly to the single main landmark', async () => {
    await navigate('/dashboard'); http.expectOne('/api/v1/dashboard').flush(empty); await stable();
    click('.skip-link');
    expect(element.querySelectorAll('main')).toHaveLength(1);
    expect(document.activeElement).toBe(element.querySelector('main'));
    expect(router.url).toBe('/dashboard');
  });

  it('shows the real cached user, refreshes it from the existing profile call and never requests it from the layout', async () => {
    const auth = TestBed.inject(AuthService);
    auth.login({ email: user.email, password: 'test-password' }).subscribe();
    http.expectOne('/api/v1/login').flush({ token: 'test-token', user });
    await navigate('/dashboard'); http.expectOne('/api/v1/dashboard').flush(empty); await stable();
    expect(element.querySelector('header .user')!.textContent).toContain(user.name);
    http.expectNone('/api/v1/profile');
    await navigate('/inicio');
    http.expectOne('/api/v1/profile').flush({ ...user, name: 'Nombre actualizado' }); await stable();
    expect(element.querySelector('header .user')!.textContent).toContain('Nombre actualizado');
    await navigate('/gastos'); expenses(); await stable();
    expect(element.querySelector('header .user')!.textContent).toContain('Nombre actualizado');
    http.expectNone('/api/v1/profile');
  });

  it('does not invent a username or load a profile when opening expenses directly', async () => {
    await navigate('/gastos'); expenses(); await stable();
    expect(element.querySelector('header .user')).toBeNull();
    http.expectNone('/api/v1/profile');
  });

  it('logs out using the auth service, clears the cached user and hides authenticated navigation', async () => {
    await navigate('/inicio'); http.expectOne('/api/v1/profile').flush(user); await stable();
    const auth = TestBed.inject(AuthService);
    const logout = vi.spyOn(auth, 'logout');
    click('button.logout'); await stable();
    expect(logout).toHaveBeenCalledTimes(1);
    expect(auth.token).toBeNull();
    expect(auth.user()).toBeNull();
    expect(router.url).toBe('/login');
    expect(element.querySelector('aside')).toBeNull();
    expect(element.querySelector('header')).toBeNull();
    await navigate('/gastos');
    expect(router.url).toBe('/login');
    http.expectNone('/api/v1/expenses');
  });
});
