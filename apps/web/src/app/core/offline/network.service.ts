import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class NetworkService {
  readonly isOnline = signal<boolean>(
    typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true,
  );

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.isOnline.set(true));
      window.addEventListener('offline', () => this.isOnline.set(false));
    }
  }
}
