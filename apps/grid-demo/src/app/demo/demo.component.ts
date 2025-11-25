import { Component, OnInit, TemplateRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import {
  GridOptions,
  ColumnType,
  FilterOperator,
  SortDirection,
  SelectionMode,
  EditMode,
  DataSourceParams,
  PageResult
} from '../../../../../projects/ng-data-grid/src/public-api';

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  rating: number;
  description: string;
  active: boolean;
  createdAt: Date;
}

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  position: string;
  salary: number;
  hireDate: Date;
  isActive: boolean;
  skills: string[];
  phoneNumber: string;
}

interface Order {
  orderId: string;
  customerName: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  orderDate: Date;
  status: string;
  paymentMethod: string;
  shippingAddress: string;
  orderNotes: string;
}

interface Event {
  eventId: string;
  eventName: string;
  eventType: string;
  location: string;
  startDate: Date;
  endDate: Date;
  attendees: number;
  capacity: number;
  ticketPrice: number;
  organizer: string;
  status: string;
  description: string;
}

interface Inventory {
  itemCode: string;
  itemName: string;
  category: string;
  supplier: string;
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  unitCost: number;
  lastRestocked: Date;
  location: string;
  isLowStock: boolean;
  reorderQuantity: number;
}

type DataType = Product | Employee | Order | Event | Inventory;

@Component({
  selector: 'app-demo',
  templateUrl: './demo.component.html',
  styleUrls: ['./demo.component.css']
})
export class DemoComponent implements OnInit {
  @ViewChild('statusTemplate', { static: true }) statusTemplate!: TemplateRef<any>;
  @ViewChild('ratingTemplate', { static: true }) ratingTemplate!: TemplateRef<any>;
  
  private allData: DataType[] = [];
  private serverData: DataType[] = [];
  
  currentDataType: 'products' | 'employees' | 'orders' | 'events' | 'inventory' = 'products';
  
  dataTypes: Array<{ value: 'products' | 'employees' | 'orders' | 'events' | 'inventory'; label: string }> = [
    { value: 'products', label: 'Products' },
    { value: 'employees', label: 'Employees' },
    { value: 'orders', label: 'Orders' },
    { value: 'events', label: 'Events' },
    { value: 'inventory', label: 'Inventory' }
  ];
  
  clientSideOptions: GridOptions<any> | null = null;
  serverSideOptions: GridOptions<any> | null = null;
  
  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}
  
  ngOnInit(): void {
    this.loadDataByType('products');
  }
  
  loadDataByType(type: 'products' | 'employees' | 'orders' | 'events' | 'inventory'): void {
    this.currentDataType = type;
    
    // Reset grid options to null to clear filters and reset grid state
    this.clientSideOptions = null;
    this.serverSideOptions = null;
    this.cdr.detectChanges();
    
    const fileMap: Record<string, string> = {
      products: '/assets/client-data.json',
      employees: '/assets/employees-data.json',
      orders: '/assets/orders-data.json',
      events: '/assets/events-data.json',
      inventory: '/assets/inventory-data.json'
    };
    
    this.http.get<any[]>(fileMap[type]).subscribe({
      next: (data) => {
        this.allData = this.parseDates(data);
        this.setupClientSideGrid(type);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error(`Error loading ${type} data:`, error);
        this.allData = [];
        this.setupClientSideGrid(type);
        this.cdr.detectChanges();
      }
    });
    
    const serverFileMap: Record<string, string> = {
      products: '/assets/server-data.json',
      employees: '/assets/employees-data.json',
      orders: '/assets/orders-data.json',
      events: '/assets/events-data.json',
      inventory: '/assets/inventory-data.json'
    };
    
    this.http.get<any[]>(serverFileMap[type]).subscribe({
      next: (data) => {
        this.serverData = this.parseDates(data);
        this.setupServerSideGrid(type);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error(`Error loading server ${type} data:`, error);
        this.serverData = [];
        this.setupServerSideGrid(type);
      }
    });
  }
  
  private parseDates(data: any[]): any[] {
    if (!data || data.length === 0) return data;
    
    const firstItem = data[0];
    const dateFields: string[] = [];
    
    Object.keys(firstItem).forEach(field => {
      const value = firstItem[field];
      if (this.isDateString(String(value)) || field.toLowerCase().includes('date') || field.toLowerCase().includes('time')) {
        dateFields.push(field);
      }
    });
    
    return data.map(item => {
      const parsed = { ...item };
      dateFields.forEach(field => {
        if (parsed[field] && typeof parsed[field] === 'string') {
          parsed[field] = new Date(parsed[field]);
        }
      });
      return parsed;
    });
  }
  
  private detectColumnType(value: any): ColumnType {
    if (value === null || value === undefined) {
      return ColumnType.String;
    }
    
    if (typeof value === 'boolean') {
      return ColumnType.Boolean;
    }
    
    if (typeof value === 'number') {
      return ColumnType.Number;
    }
    
    if (value instanceof Date) {
      return ColumnType.Date;
    }
    
    if (typeof value === 'string') {
      if (this.isDateString(value)) {
        return ColumnType.Date;
      }
      return ColumnType.String;
    }
    
    if (Array.isArray(value)) {
      return ColumnType.String;
    }
    
    return ColumnType.String;
  }
  
  private isDateString(value: string): boolean {
    if (!value || typeof value !== 'string') return false;
    const dateRegex = /^\d{4}-\d{2}-\d{2}/;
    return dateRegex.test(value) && !isNaN(Date.parse(value));
  }
  
  private formatFieldName(field: string): string {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
  
  private getColumnsFromData(data: any[]): any[] {
    if (!data || data.length === 0) {
      return [];
    }
    
    const firstItem = data[0];
    const columns: any[] = [];
    const fieldNames = Object.keys(firstItem);
    
    fieldNames.forEach((field, index) => {
      const sampleValue = firstItem[field];
      const columnType = this.detectColumnType(sampleValue);
      
      const column: any = {
        field: field,
        title: this.formatFieldName(field),
        type: columnType,
        width: this.calculateColumnWidth(field, columnType, sampleValue),
        sortable: true,
        filterable: true,
        resizable: true,
        editable: columnType !== ColumnType.Boolean && !field.toLowerCase().includes('id') && !field.toLowerCase().includes('date')
      };
      
      if (columnType === ColumnType.Number) {
        column.align = 'right';
        if (this.isCurrencyField(field, sampleValue)) {
          column.valueFormatter = (value: any) => {
            if (value === null || value === undefined) return '';
            return `$${Number(value).toFixed(2)}`;
          };
        }
      }
      
      if (columnType === ColumnType.Date) {
        column.valueFormatter = (value: any) => {
          if (!value) return '';
          const date = value instanceof Date ? value : new Date(value);
          return date.toLocaleDateString();
        };
      }
      
      if (columnType === ColumnType.Boolean) {
        if (field.toLowerCase().includes('active') || field.toLowerCase().includes('status') || field.toLowerCase().includes('low')) {
          column.cellTemplate = this.statusTemplate;
        }
      }
      
      if (field.toLowerCase().includes('rating') && columnType === ColumnType.Number) {
        column.cellTemplate = this.ratingTemplate;
      }
      
      if (index === 0 || field.toLowerCase().includes('id') || field.toLowerCase().includes('name') || field.toLowerCase().includes('code')) {
        column.pinned = 'left';
      }
      
      columns.push(column);
    });
    
    return columns;
  }
  
  private calculateColumnWidth(field: string, type: ColumnType, sampleValue: any): number {
    const fieldNameLength = field.length;
    const baseWidth = Math.max(100, fieldNameLength * 10);
    
    if (type === ColumnType.Number) {
      return Math.max(100, baseWidth);
    }
    
    if (type === ColumnType.Boolean) {
      return 100;
    }
    
    if (type === ColumnType.Date) {
      return 130;
    }
    
    if (sampleValue && typeof sampleValue === 'string') {
      return Math.min(300, Math.max(150, sampleValue.length * 8));
    }
    
    return Math.max(120, baseWidth);
  }
  
  private isCurrencyField(field: string, value: any): boolean {
    const currencyFields = ['price', 'cost', 'amount', 'salary', 'total', 'unitprice', 'ticketprice'];
    const lowerField = field.toLowerCase();
    return currencyFields.some(cf => lowerField.includes(cf)) || 
           (typeof value === 'number' && value > 0 && value < 10000 && value % 0.01 === 0);
  }
  
  private detectRowKey(data: any[]): string | undefined {
    if (!data || data.length === 0) return undefined;
    const firstItem = data[0];
    const keyFields = ['id', 'orderId', 'eventId', 'itemCode'];
    for (const field of keyFields) {
      if (firstItem.hasOwnProperty(field)) {
        return field;
      }
    }
    return Object.keys(firstItem)[0];
  }
  
  private setupClientSideGrid(type: string = 'products'): void {
    const columns = this.getColumnsFromData(this.allData);
    const rowKey = this.detectRowKey(this.allData);
    this.clientSideOptions = {
      columns: columns,
      dataSource: this.allData,
      pageSizeOptions: [10, 20, 50, 100],
      defaultPageSize: 20,
      defaultSort: columns.length > 0 ? [{ field: columns[0].field, direction: SortDirection.Asc }] : [],
      defaultFilters: [], // Clear filters when switching data types
      defaultGroups: undefined,
      editable: true,
      editMode: EditMode.Cell,
      selectionMode: SelectionMode.Multiple,
      rowKey: rowKey,
      virtualScroll: true,
      virtualScrollBuffer: 5,
      columnReorder: true,
      columnResize: true,
      persistSettings: true,
      settingsKey: `client-side-grid-${type}`, // Unique key per data type to prevent filter persistence
      showHeader: true,
      showFooter: true,
      showRowNumbers: true,
      enableExport: true,
      exportFormats: ['csv', 'excel', 'pdf'],
      keyboardNavigation: true,
      rowHeight: 40,
      headerHeight: 40
    };
  }
  
  private setupServerSideGrid(type: string = 'products'): void {
    const columns = this.getColumnsFromData(this.serverData);
    const rowKey = this.detectRowKey(this.serverData);
    this.serverSideOptions = {
      columns: columns,
      dataSource: (params: DataSourceParams) => this.getServerData(params),
      pageSizeOptions: [10, 20, 50, 100],
      defaultPageSize: 20,
      editable: true,
      editMode: EditMode.Cell,
      selectionMode: SelectionMode.Multiple,
      rowKey: rowKey,
      virtualScroll: false,
      columnReorder: true,
      columnResize: true,
      persistSettings: true,
      settingsKey: 'server-side-grid',
      showHeader: true,
      showFooter: true,
      showRowNumbers: true,
      enableExport: true,
      exportFormats: ['csv', 'excel', 'pdf'],
      keyboardNavigation: true,
      rowHeight: 40,
      headerHeight: 40
    };
  }
  
  private getServerData(params: DataSourceParams): Observable<PageResult<any>> {
    return of(null).pipe(
      delay(300),
      map(() => {
        let data = [...this.serverData];
        
        if (params.filters && params.filters.length > 0) {
          data = data.filter(row => {
            return params.filters!.every((filter: any) => {
              const value = this.getFieldValue(row, filter.field);
              switch (filter.operator) {
                case FilterOperator.Contains:
                  return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
                case FilterOperator.GreaterThan:
                  return Number(value) > Number(filter.value);
                case FilterOperator.LessThan:
                  return Number(value) < Number(filter.value);
                default:
                  return true;
              }
            });
          });
        }
        
        if (params.sort && params.sort.length > 0) {
          data.sort((a, b) => {
            for (const sort of params.sort!) {
              const aVal = this.getFieldValue(a, sort.field);
              const bVal = this.getFieldValue(b, sort.field);
              let comparison = 0;
              
              if (aVal > bVal) comparison = 1;
              else if (aVal < bVal) comparison = -1;
              
              if (sort.direction === SortDirection.Desc) comparison *= -1;
              if (comparison !== 0) return comparison;
            }
            return 0;
          });
        }
        
        const total = data.length;
        const skip = params.skip || 0;
        const take = params.take || 20;
        const pageData = data.slice(skip, skip + take);
        
        return {
          data: pageData,
          total,
          page: params.page,
          pageSize: params.pageSize
        };
      })
    );
  }
  
  private getFieldValue(obj: any, field: string): any {
    return field.split('.').reduce((o, p) => o?.[p], obj);
  }
  
  onRowClick(event: any): void {}
  onCellClick(event: any): void {}
  onSelectionChange(event: any): void {}
  onSortChange(event: any): void {}
  onFilterChange(event: any): void {}
  onPageChange(event: any): void {}
  onEditSave(event: any): void {}
  
  getStars(rating: number): string {
    const filled = Math.floor(rating);
    const empty = 5 - filled;
    return '★'.repeat(filled) + '☆'.repeat(empty);
  }
}

