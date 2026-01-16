import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AppComponent } from './app.component';
import { NgDataGridModule } from '../../../../projects/ng-data-grid/src/public-api';
import { AngularDataGridWidgetComponent } from './server-demo/angular-data-grid-widget.component';
import { AngularDataGridViewComponent } from './server-demo/angular-data-grid-view.component';
import { PayloadPopupComponent } from './server-demo/payload-popup.component';
import { AppRoutingModule } from './app-routing.module';

@NgModule({
  declarations: [
    AppComponent,
    AngularDataGridWidgetComponent,
    AngularDataGridViewComponent,
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

