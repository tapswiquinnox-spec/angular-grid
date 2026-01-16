import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AppComponent } from './app.component';
import { NgDataGridModule } from '../../../../projects/ng-data-grid/src/public-api';
import { ServerDemoComponent } from './server-demo/server-demo.component';
import { ServerGridComponent } from './server-demo/server-grid.component';
import { PayloadPopupComponent } from './server-demo/payload-popup.component';
import { AppRoutingModule } from './app-routing.module';

@NgModule({
  declarations: [
    AppComponent,
    ServerDemoComponent,
    ServerGridComponent,
    PayloadPopupComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    FormsModule,
    RouterModule,
    NgDataGridModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }

