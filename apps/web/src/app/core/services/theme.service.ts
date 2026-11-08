import { Injectable, signal } from '@angular/core';

export type AppTheme = 'light';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  /**
   * Résidence Blue n'a QU'UN SEUL thème : mode clair avec barre latérale #2a3135.
   * Tout mode sombre est strictement exclu conformément à AGENTS.md.
   */
  readonly theme = signal<AppTheme>('light');

  constructor() {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('dark');
      try {
        localStorage.removeItem('residence_blue_theme');
      } catch {
        // ignore storage errors in sandbox
      }
    }
  }

  isDark(): boolean {
    return false;
  }
}
