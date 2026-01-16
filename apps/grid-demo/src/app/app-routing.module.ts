import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AngularDataGridWidgetComponent } from './server-demo/angular-data-grid-widget.component';

const routes: Routes = [
  { path: '', component: AngularDataGridWidgetComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }


