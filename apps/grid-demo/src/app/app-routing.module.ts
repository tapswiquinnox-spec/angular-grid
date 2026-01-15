import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ServerDemoComponent } from './server-demo/server-demo.component';

const routes: Routes = [
  { path: '', component: ServerDemoComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }


