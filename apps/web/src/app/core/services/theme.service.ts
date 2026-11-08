import { Injectable, signal, effect } from '@angular/core';

export type AppTheme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_STORAGE_KEY = 'residence_blue_theme';

  readonly theme = signal<AppTheme>(this.getInitialTheme());

  constructor() {
    effect(() => {
      const current = this.theme();
      if (typeof document !== 'undefined') {
        const root = document.documentElement;
        if (current === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
        try {
          localStorage.setItem(this.THEME_STORAGE_KEY, current);
        } catch {
          // ignore storage access errors in private/sandboxed mode
        }
      }
    });
  }

  toggleTheme(): void {
    this.theme.update(t => (t === 'dark' ? 'light' : 'dark'));
  }

  setTheme(newTheme: AppTheme): void {
    this.theme.set(newTheme);
  }

  private getInitialTheme(): AppTheme {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(this.THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') {
        return saved;
      }
    }
    return 'light';
  }
}
