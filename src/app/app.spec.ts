import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { App } from './app';

describe('App', () => {
  it('renders the main route outlet', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('main router-outlet')).not.toBeNull();
  });
});
