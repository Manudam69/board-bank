import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { AppRefreshService } from './core/services/app-refresh.service';
import { PullRefreshComponent } from './shared/components/ui/pull-refresh.component';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('uses the pull gesture to reload the application rather than only its data', async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    TestBed.overrideProvider(AppRefreshService, { useValue: { reload } });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const refresh = fixture.debugElement.query(By.directive(PullRefreshComponent))
      .componentInstance as PullRefreshComponent;
    await refresh.refresh()();
    expect(reload).toHaveBeenCalledOnce();
  });
});
