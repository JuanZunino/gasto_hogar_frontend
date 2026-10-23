import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  it('renders the main route outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('main router-outlet')).not.toBeNull();
  });
});
