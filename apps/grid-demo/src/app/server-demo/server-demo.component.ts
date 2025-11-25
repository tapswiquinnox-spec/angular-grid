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

@Component({
  selector: 'app-server-demo',
  templateUrl: './server-demo.component.html',
  styleUrls: ['./server-demo.component.css']
})
export class ServerDemoComponent implements OnInit {
  @ViewChild('statusTemplate', { static: true }) statusTemplate!: TemplateRef<any>;
  @ViewChild('ratingTemplate', { static: true }) ratingTemplate!: TemplateRef<any>;
  
  private serverData: any[] = [];
  
  currentDataType: 'products' | 'employees' | 'orders' | 'events' | 'inventory' = 'products';
  
  dataTypes: Array<{ value: 'products' | 'employees' | 'orders' | 'events' | 'inventory'; label: string }> = [
    { value: 'products', label: 'Products' },
    { value: 'employees', label: 'Employees' },
    { value: 'orders', label: 'Orders' },
    { value: 'events', label: 'Events' },
    { value: 'inventory', label: 'Inventory' }
  ];
  
  serverSideOptions: GridOptions<any> | null = null;
  
  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}
  
  ngOnInit(): void {
    this.loadDataByType('products');
  }
  
  loadDataByType(type: 'products' | 'employees' | 'orders' | 'events' | 'inventory'): void {
    this.currentDataType = type;
    
    // Reset grid options to null to clear filters and reset grid state
    this.serverSideOptions = null;
    this.cdr.detectChanges();
    
    const fileMap: Record<string, string> = {
      products: '/assets/server-data.json',
      employees: '/assets/employees-data.json',
      orders: '/assets/orders-data.json',
      events: '/assets/events-data.json',
      inventory: '/assets/inventory-data.json'
    };
    
    console.log(`[SERVER-SIDE DEBUG] Loading ${type} data from JSON file...`);
    this.http.get<any[]>(fileMap[type]).subscribe({
      next: (data) => {
        this.serverData = this.parseDates(data);
        console.log(`[SERVER-SIDE DEBUG] ${type} data loaded successfully:`, {
          totalItems: this.serverData.length,
          sampleItems: this.serverData.slice(0, 3)
        });
        this.setupServerSideGrid(type);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error(`[SERVER-SIDE DEBUG] Error loading ${type} data:`, error);
        this.serverData = [];
        this.setupServerSideGrid(type);
        this.cdr.detectChanges();
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
  
  private setupServerSideGrid(type: string = 'products'): void {
    const columns = this.getColumnsFromData(this.serverData);
    const rowKey = this.detectRowKey(this.serverData);
    this.serverSideOptions = {
      columns: columns,
      dataSource: (params: DataSourceParams) => this.getServerData(params),
      pageSizeOptions: [10, 20, 50, 100],
      defaultPageSize: 20,
      defaultFilters: [], // Clear filters when switching data types
      editable: true,
      editMode: EditMode.Cell,
      selectionMode: SelectionMode.Multiple,
      rowKey: rowKey,
      virtualScroll: false,
      columnReorder: true,
      columnResize: true,
      persistSettings: true,
      settingsKey: `server-side-grid-${type}`, // Unique key per data type to prevent filter persistence
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
    // Log input parameters
    console.log('[SERVER-SIDE DEBUG] INPUT:', {
      timestamp: new Date().toISOString(),
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        skip: params.skip,
        take: params.take
      },
      sorting: params.sort || [],
      filters: params.filters || [],
      groups: params.groups || [],
      infiniteScroll: params.infiniteScroll || false,
      totalDataSourceItems: this.serverData.length
    });
    
    return of(null).pipe(
      delay(300),
      map(() => {
        let data = [...this.serverData];
        const initialCount = data.length;
        
        // Apply filtering
        if (params.filters && params.filters.length > 0) {
          const beforeFilterCount = data.length;
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
          console.log('[SERVER-SIDE DEBUG] AFTER FILTER:', {
            beforeCount: beforeFilterCount,
            afterCount: data.length,
            filtersApplied: params.filters.length,
            removedItems: beforeFilterCount - data.length
          });
        }
        
        // Apply sorting
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
          console.log('[SERVER-SIDE DEBUG] AFTER SORT:', {
            sortFields: params.sort.map(s => `${s.field} (${s.direction})`),
            sortedCount: data.length
          });
        }
        
        // Apply pagination
        const total = data.length;
        const skip = params.skip || 0;
        const take = params.take || 20;
        const pageData = data.slice(skip, skip + take);
        
        const result = {
          data: pageData,
          total,
          page: params.page,
          pageSize: params.pageSize
        };
        
        // Log output result
        console.log('[SERVER-SIDE DEBUG] OUTPUT:', {
          timestamp: new Date().toISOString(),
          pagination: {
            page: result.page,
            pageSize: result.pageSize,
            skip: skip,
            take: take,
            totalItems: result.total,
            returnedItems: result.data.length,
            hasMorePages: skip + take < total
          },
          dataPreview: result.data.slice(0, 3).map(item => ({
            id: item.id,
            name: item.name,
            category: item.category,
            price: item.price
          })),
          processingTime: '~300ms (simulated)'
        });
        
        return result;
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

