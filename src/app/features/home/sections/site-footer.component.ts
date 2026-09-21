import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LogoComponent } from '../../../shared/components/ui/logo.component';

@Component({
  selector: 'app-site-footer',
  imports: [LogoComponent, RouterLink],
  template: `
    <footer class="border-t border-border bg-surface px-4 py-8">
      <div class="mx-auto flex max-w-5xl flex-col items-center gap-3 text-center">
        <div class="flex items-center gap-2 text-text">
          <app-logo size="sm" class="text-accent" />
          <span class="font-semibold tracking-tight">BoardBank</span>
        </div>
        <p class="text-sm text-text-secondary">Digitaliza tu partida de Monopoly.</p>
        <nav class="mt-1 flex items-center gap-4 text-xs text-text-muted">
          <a href="#como-funciona" class="transition hover:text-text">¿Cómo funciona?</a>
          <a routerLink="/editions" class="transition hover:text-text">Ediciones</a>
        </nav>
      </div>
    </footer>
  `,
})
export class SiteFooterComponent {}
