import { Component, OnInit, TemplateRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  GridOptions,
  ColumnType,
  FilterOperator,
  FilterCondition,
  SortDirection,
  SortConfig,
  SortChangeEvent,
  FilterChangeEvent,
  DataStateChangeEvent,
  GroupConfig,
  PageChangeEvent,
  SelectionMode,
  EditMode,
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
  
  currentDataType: 'mockApi' = 'mockApi';
  
  dataTypes: Array<{ value: 'mockApi'; label: string }> = [
    { value: 'mockApi', label: 'Mock API (Products)' }
  ];
  
  serverSideOptions: GridOptions<any> | null = null;
  private dataStream = new BehaviorSubject<PageResult<any>>({ data: [], total: 0, page: 1, pageSize: 10 });
  private mockApiCache = new Map<string, any[]>();
  private mockApiTotal = 0;
  private currentPage = 1;
  private pageSize = 10;
  private currentSort: SortConfig[] = [];
  private currentFilters: FilterCondition[] = [];
  private currentGroups: GroupConfig[] = [];
  
  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}
  
  ngOnInit(): void {
    this.loadDataByType('mockApi');
  }
  
  loadDataByType(type: 'mockApi' = 'mockApi'): void {
    this.currentDataType = type;
    
    // Reset grid options to null to clear filters and reset grid state
    this.serverSideOptions = null;
    this.cdr.detectChanges();
    
    // Clear mock cache when switching types
    this.mockApiCache.clear();
    this.mockApiTotal = 0;
    this.currentPage = 1;
    this.pageSize = 10;
    this.currentSort = [];
    this.currentFilters = [];
    this.currentGroups = [];
    
    const initialPage = this.currentPage;
    const initialPageSize = this.pageSize;
    console.log('[SERVER-SIDE DEBUG] Loading mock API data from https://dummyjson.com/products per page...');
    this.fetchMockApiPage(initialPage, initialPageSize).subscribe({
      next: ({ data, total }) => {
        this.mockApiTotal = total;
        this.mockApiCache.set(`${initialPage}-${initialPageSize}`, data);
        this.serverData = this.parseDates(data); // use first page to infer columns
        console.log('[SERVER-SIDE DEBUG] mockApi first page loaded for columns:', {
          totalItems: total,
          sampleItems: this.serverData.slice(0, 3)
        });
        this.setupServerSideGrid(type);
        this.emitPageResult(data, total, initialPage, initialPageSize);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('[SERVER-SIDE DEBUG] Error loading mockApi data:', error);
        this.serverData = [];
        this.setupServerSideGrid(type);
        this.emitPageResult([], 0, initialPage, initialPageSize);
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
      dataSource: this.dataStream.asObservable(),
      pageSizeOptions: [10, 20, 50, 100],
      defaultPageSize: 10,
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
  
  private getFieldValue(obj: any, field: string): any {
    return field.split('.').reduce((o, p) => o?.[p], obj);
  }

  private emitPageResult(data: any[], total: number, page: number, pageSize: number): void {
    const parsed = this.parseDates(data);
    this.dataStream.next({ data: parsed, total, page, pageSize });
    this.cdr.detectChanges();
  }

  private emitLocalPage(): void {
    let data = [...this.serverData];
    // Filters
    if (this.currentFilters && this.currentFilters.length > 0) {
      data = data.filter(row => {
        return this.currentFilters.every(filter => {
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
    // Sort
    if (this.currentSort && this.currentSort.length > 0) {
      data.sort((a, b) => {
        for (const sort of this.currentSort) {
          const aVal = this.getFieldValue(a, sort.field);
          const bVal = this.getFieldValue(b, sort.field);
          let cmp = 0;
          if (aVal > bVal) cmp = 1;
          else if (aVal < bVal) cmp = -1;
          if (sort.direction === SortDirection.Desc) cmp *= -1;
          if (cmp !== 0) return cmp;
        }
        return 0;
      });
    }
    const total = data.length;
    const skip = (this.currentPage - 1) * this.pageSize;
    const pageData = data.slice(skip, skip + this.pageSize);
    this.emitPageResult(pageData, total, this.currentPage, this.pageSize);
  }

  private triggerFetch(): void {
    if (this.currentDataType === 'mockApi') {
      const page = this.currentPage;
      const pageSize = this.pageSize;
      const needsFullFetch =
        (this.currentFilters && this.currentFilters.length > 0) ||
        (this.currentGroups && this.currentGroups.length > 0) ||
        (this.currentSort && this.currentSort.length > 0);
      const fetchPage = needsFullFetch ? 1 : page;
      const fetchSize = needsFullFetch ? 100 : pageSize;
      const cacheKey = `p${fetchPage}-s${fetchSize}-sort${JSON.stringify(this.currentSort)}-f${JSON.stringify(this.currentFilters)}-g${JSON.stringify(this.currentGroups)}`;
      
      if (this.mockApiCache.has(cacheKey)) {
        const cached = this.mockApiCache.get(cacheKey) || [];
        this.processAndEmit(cached, this.mockApiTotal, page, pageSize, needsFullFetch);
        return;
      }
      
      this.fetchMockApiPage(fetchPage, fetchSize).subscribe({
        next: ({ data, total }) => {
          this.mockApiTotal = total;
          this.mockApiCache.set(cacheKey, data);
          this.processAndEmit(data, total, page, pageSize, needsFullFetch);
        },
        error: (error) => {
          console.error('[SERVER-SIDE DEBUG] Error loading mockApi page:', error);
          this.emitPageResult([], 0, page, pageSize);
        }
      });
      return;
    }
  }

  private fetchMockApiPage(page: number, pageSize: number): Observable<{ data: any[]; total: number }> {
    const skip = (page - 1) * pageSize;
    const url = `https://dummyjson.com/products?limit=${pageSize}&skip=${skip}`;
    return this.http.get<any>(url).pipe(
      map(resp => {
        const data = Array.isArray(resp) ? resp : resp?.products || [];
        const total = resp?.total ?? data.length;
        return { data, total };
      })
    );
  }
  
  private processAndEmit(rawData: any[], total: number, page: number, pageSize: number, needsFullFetch: boolean): void {
    let data = this.parseDates(rawData);
    
    // Apply filters/sort client-side when server API cannot
    if (needsFullFetch) {
      if (this.currentFilters && this.currentFilters.length > 0) {
        data = data.filter(row => {
          return this.currentFilters.every(filter => {
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
      
      if (this.currentSort && this.currentSort.length > 0) {
        data.sort((a, b) => {
          for (const sort of this.currentSort) {
            const aVal = this.getFieldValue(a, sort.field);
            const bVal = this.getFieldValue(b, sort.field);
            let cmp = 0;
            if (aVal > bVal) cmp = 1;
            else if (aVal < bVal) cmp = -1;
            if (sort.direction === SortDirection.Desc) cmp *= -1;
            if (cmp !== 0) return cmp;
          }
          return 0;
        });
      }
      
      // Grouping note: mock API does not support grouping; data is left flat.
      const filteredTotal = data.length;
      const skip = (page - 1) * pageSize;
      const pageData = data.slice(skip, skip + pageSize);
      this.emitPageResult(pageData, filteredTotal, page, pageSize);
      return;
    }
    
    this.emitPageResult(data, total, page, pageSize);
  }
  
  onRowClick(event: any): void {}
  onCellClick(event: any): void {}
  onSelectionChange(event: any): void {}
  onSortChange(event: SortChangeEvent): void {
    this.currentSort = event?.sort || [];
    this.currentPage = 1;
    this.triggerFetch();
  }
  onFilterChange(event: FilterChangeEvent): void {
    this.currentFilters = event?.filters || [];
    this.currentPage = 1;
    this.triggerFetch();
  }
  onPageChange(event: PageChangeEvent): void {
    this.currentPage = event?.page || 1;
    this.pageSize = event?.pageSize || this.pageSize;
    this.triggerFetch();
  }
  onDataStateChange(event: DataStateChangeEvent): void {
    this.currentSort = event?.sort || [];
    this.currentFilters = event?.filters || [];
    this.currentGroups = event?.groups || [];
    if (event?.take) {
      this.pageSize = event.take;
    }
    if (event?.skip !== undefined && event.take) {
      this.currentPage = Math.floor(event.skip / event.take) + 1;
    }
    this.triggerFetch();
  }
  onEditSave(event: any): void {}
  
  getStars(rating: number): string {
    const filled = Math.floor(rating);
    const empty = 5 - filled;
    return '★'.repeat(filled) + '☆'.repeat(empty);
  }
}

