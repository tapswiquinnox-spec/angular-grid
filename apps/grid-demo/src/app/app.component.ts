import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <div class="app-container">
      <header class="app-header">
        <h1>Angular Data Grid Demo</h1>
        <p>Production-ready data grid component with all features</p>
      </header>
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
    .app-header {
      background: linear-gradient(135deg, #0078d4 0%, #005a9e 100%);
      color: white;
      padding: 16px 20px;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0, 120, 212, 0.2);
      flex-shrink: 0;
    }
    .app-header h1 {
      margin: 0 0 4px 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .app-header p {
      margin: 0;
      opacity: 0.95;
      font-size: 14px;
      font-weight: 400;
      letter-spacing: 0.2px;
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
export class AppComponent {
  title = 'Angular Data Grid Demo';
}


