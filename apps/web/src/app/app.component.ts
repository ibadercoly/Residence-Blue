import { Component, inject, signal } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { LayoutComponent } from './shared/components/layout/layout.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LayoutComponent],
  template: `
    @if (isConnexion()) {
      <router-outlet />
    } @else {
      <app-layout>
        <router-outlet />
      </app-layout>
    }
  `
})
export class AppComponent {
  private readonly router = inject(Router);

  readonly isConnexion = signal<boolean>(
    typeof window !== 'undefined' ? window.location.pathname.startsWith('/connexion') : false
  );

  constructor() {
    if (this.router?.events?.subscribe) {
      this.router.events.subscribe((event: unknown) => {
        if (event instanceof NavigationEnd) {
          const url = event.urlAfterRedirects || event.url || '';
          this.isConnexion.set(url.startsWith('/connexion'));
        }
      });
    }
  }
}
