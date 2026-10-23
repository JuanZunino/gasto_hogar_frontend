import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { authInterceptor } from './auth.interceptor';
import { AuthService, AuthUser } from './auth.service';

const user: AuthUser = { id: 1, name: 'Ana Pérez', email: 'ana@example.com', role: 'member' };

describe('Authentication flow', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  function submit(harness: RouterTestingHarness): void {
    const element = harness.routeNativeElement!;
    for (const [selector, value] of [['#email', user.email], ['#password', 'test-password']]) {
      const input = element.querySelector<HTMLInputElement>(selector)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    harness.detectChanges();
  }

  it('presents the real login fields with brand, visible labels, error associations and initial focus', async () => {
    const harness = await RouterTestingHarness.create('/login');
    const element = harness.routeNativeElement!;
    expect(element.querySelector('.brand')!.textContent).toContain('GastoHogar');
    expect(element.querySelector('.brand svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(document.activeElement).toBe(element.querySelector('h1'));
    expect(element.querySelector<HTMLInputElement>('#email')!.labels![0].textContent).toBe('Correo electrónico');
    expect(element.querySelector<HTMLInputElement>('#password')!.labels![0].textContent).toBe('Contraseña');
    expect(element.querySelector<HTMLInputElement>('#password')!.type).toBe('password');
    expect(element.querySelector<HTMLInputElement>('#email')!.autocomplete).toBe('username');
    expect(element.querySelector<HTMLInputElement>('#password')!.autocomplete).toBe('current-password');
    for (const id of ['email', 'password']) {
      expect(element.querySelector('#' + id)!.getAttribute('aria-describedby')).toBe(id + '-error');
      expect(element.querySelector('#' + id + '-error')).not.toBeNull();
    }
    expect(element.querySelectorAll('input')).toHaveLength(2);
    expect(element.querySelectorAll('button')).toHaveLength(1);
    expect(element.querySelectorAll('a')).toHaveLength(0);
    http.expectNone('/api/v1/login');
  });

  it('logs in with a flat JSON body, loads the real profile and logs out locally', async () => {
    const harness = await RouterTestingHarness.create('/login');
    submit(harness);
    const request = http.expectOne('/api/v1/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: user.email, password: 'test-password' });
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(harness.routeNativeElement!.querySelector('button')!.disabled).toBe(true);
    // A second submission while pending must not create another request.
    submit(harness);
    http.expectNone('/api/v1/login');
    request.flush({ token: 'test-token', user });
    await harness.fixture.whenStable();
    const profile = http.expectOne('/api/v1/profile');
    expect(profile.request.method).toBe('GET');
    expect(profile.request.headers.get('Authorization')).toBe('Bearer test-token');
    profile.flush({ ...user, name: 'Nombre del perfil real' });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/inicio');
    expect(harness.routeNativeElement!.textContent).toContain('Nombre del perfil real');
    expect(harness.routeNativeElement!.textContent).toContain(user.email);
    expect(TestBed.inject(AuthService).token).toBe('test-token');
    TestBed.inject(AuthService).logout();
    await harness.fixture.whenStable();
    expect(TestBed.inject(AuthService).token).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('shows an authentication error and allows retrying without saving a token', async () => {
    const harness = await RouterTestingHarness.create('/login');
    submit(harness);
    http.expectOne('/api/v1/login').flush({}, { status: 401, statusText: 'Unauthorized' });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')!.textContent)
      .toContain('Email o contraseña incorrectos');
    expect(harness.routeNativeElement!.querySelector('button')!.disabled).toBe(false);
    expect(TestBed.inject(AuthService).token).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/login');
    http.expectNone('/api/v1/profile');
  });

  it('validates required fields and email before sending a request', async () => {
    const harness = await RouterTestingHarness.create('/login');
    const form = harness.routeNativeElement!.querySelector('form')!;
    form.dispatchEvent(new Event('submit'));
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Ingresá tu email.');
    expect(harness.routeNativeElement!.textContent).toContain('Ingresá tu contraseña.');
    const email = harness.routeNativeElement!.querySelector<HTMLInputElement>('#email')!;
    email.value = 'invalid';
    email.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit'));
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Ingresá un email válido.');
    http.expectNone('/api/v1/login');
  });

  it('redirects protected navigation without a token', async () => {
    await RouterTestingHarness.create('/inicio');
    expect(TestBed.inject(Router).url).toBe('/login');
    http.expectNone('/api/v1/profile');
  });

  it('clears an expired session when the profile rejects the token', async () => {
    sessionStorage.setItem('gastohogar.token', 'expired-token');
    const harness = await RouterTestingHarness.create('/inicio');
    http.expectOne('/api/v1/profile').flush({}, { status: 401, statusText: 'Unauthorized' });
    await harness.fixture.whenStable();
    expect(TestBed.inject(AuthService).token).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('shows a connection error and restores the submit button', async () => {
    const harness = await RouterTestingHarness.create('/login');
    submit(harness);
    http.expectOne('/api/v1/login').error(new ProgressEvent('error'));
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')!.textContent)
      .toContain('Verificá tu conexión');
    expect(harness.routeNativeElement!.querySelector('button')!.disabled).toBe(false);
  });

  it('adds credentials only to relative API requests except login', () => {
    sessionStorage.setItem('gastohogar.token', 'test-token');
    const client = TestBed.inject(HttpClient);
    for (const [url, authorized] of [
      ['/api/v1/profile', true],
      ['/api/v1/profile?details=1', true],
      ['/api/v1/login', false],
      ['/api/v1/login?next=home', false],
      ['/api/v1/login/', false],
      ['/api/v10/profile', false],
      ['/assets/config.json', false],
      ['https://example.com/api/v1/profile', false],
      ['//example.com/api/v1/profile', false],
    ] as const) {
      client.get(url).subscribe();
      const request = http.expectOne(url);
      expect(request.request.headers.get('Authorization')).toBe(authorized ? 'Bearer test-token' : null);
      request.flush({});
    }
  });
});
