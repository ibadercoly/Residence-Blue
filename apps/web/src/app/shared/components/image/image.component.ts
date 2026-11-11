import { Component, Input, signal, computed } from '@angular/core';

@Component({
  selector: 'app-image',
  standalone: true,
  imports: [],
  template: `
    <picture class="block w-full h-full overflow-hidden">
      @if (webpSrcset()) {
        <source type="image/webp" [srcset]="webpSrcset()" [sizes]="sizes" />
      }
      <img
        [src]="resolvedSrc()"
        [alt]="alt"
        [loading]="loading"
        [width]="width"
        [height]="height"
        [class]="cssClass"
        (error)="handleError()"
      />
    </picture>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `]
})
export class ImageComponent {
  private readonly srcSignal = signal<string>('');

  @Input({ required: true })
  set src(value: string) {
    this.srcSignal.set(value || '');
    if (this.hasError()) {
      this.hasError.set(false);
    }
  }
  get src(): string {
    return this.srcSignal();
  }

  @Input({ required: true }) alt!: string;
  @Input() width: number | string = '100%';
  @Input() height: number | string = '100%';
  @Input() loading: 'lazy' | 'eager' = 'lazy';
  @Input() sizes: string = '(max-width: 640px) 400px, (max-width: 1024px) 800px, 1600px';
  @Input() cssClass: string = 'w-full h-full object-cover';
  @Input() fallbackSrc: string = 'assets/images/chambres/chambre-fallback.jpg';

  readonly hasError = signal(false);

  readonly resolvedSrc = computed(() => {
    if (this.hasError()) {
      return this.fallbackSrc;
    }
    return this.srcSignal() || this.fallbackSrc;
  });

  readonly webpSrcset = computed(() => {
    if (this.hasError()) {
      return 'assets/images/chambres/chambre-fallback.webp 800w';
    }
    const current = this.srcSignal() || '';
    if (current.includes('assets/images/chambres/chambre-')) {
      const base = current.replace(/\.(jpg|jpeg|png|webp)$/i, '');
      return `${base}-400w.webp 400w, ${base}-800w.webp 800w, ${base}-1600w.webp 1600w`;
    }
    return '';
  });

  handleError(): void {
    if (!this.hasError()) {
      this.hasError.set(true);
    }
  }
}
