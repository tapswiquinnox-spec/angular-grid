import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataGridComponent } from './components/data-grid.component';

/**
 * NgDataGrid Module
 */
@NgModule({
  declarations: [
    DataGridComponent
  ],
  imports: [
    CommonModule,
    FormsModule
  ],
  exports: [
    DataGridComponent
  ]
})
export class NgDataGridModule { }


