import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <div class="app-container">
      <main class="app-main">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background: linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%);
    }
    .app-main {
      flex: 1;
      padding: 12px;
      max-width: 100%;
      width: 100%;
      margin: 0;
      min-height: 0;
      overflow: hidden;
    }
  `]
})
export class AppComponent {}


