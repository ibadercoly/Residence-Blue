import { Component } from '@angular/core';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [SidebarComponent, HeaderComponent],
  template: `
    <div class="min-h-screen bg-surface text-on-surface font-body-md text-body-md antialiased selection:bg-primary selection:text-on-primary">
      <app-sidebar />
      <div class="pl-64">
        <app-header />
        <main class="relative w-full pt-20 px-margin bg-surface transition-colors">
          <ng-content />
        </main>
      </div>
    </div>
  `
})
export class LayoutComponent {}
