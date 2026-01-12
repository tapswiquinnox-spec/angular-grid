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
  GroupToggleEvent,
  PageChangeEvent,
  SelectionMode,
  EditMode,
  PageResult,
  GroupRow,
  GROUP_ROW_TYPE
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
  private currentSearch: string = ''; // Global search term
  private expandedGroups = new Set<string>();
  private groupChildrenCache = new Map<string, any[]>(); // Cache children for each group
  private groupMetadataCache = new Map<string, { metadata: Array<{ value: any; key: string; count: number }>; total: number }>(); // Cache group metadata with total count
  
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
    console.log('[SERVER-SIDE DEBUG] Loading mock API data from local server /api/products...');
    this.fetchMockApiPage(initialPage, initialPageSize, [], [], [], '').subscribe({
      next: ({ data, total }) => {
        this.mockApiTotal = total;
        this.mockApiCache.set(`p${initialPage}-s${initialPageSize}-sort[]-f[]-g[]`, data);
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
      // If grouping is active, fetch group values first
      if (this.currentGroups && this.currentGroups.length > 0) {
        this.fetchGroupValues();
        return;
      }
      
      // Normal fetch without grouping
      const page = this.currentPage;
      const pageSize = this.pageSize;
      
      // Build cache key based on all parameters (including search)
      const cacheKey = `p${page}-s${pageSize}-sort${JSON.stringify(this.currentSort)}-f${JSON.stringify(this.currentFilters)}-search${this.currentSearch}-g${JSON.stringify(this.currentGroups)}`;
      
      // Check cache
      if (this.mockApiCache.has(cacheKey)) {
        const cached = this.mockApiCache.get(cacheKey) || [];
        const cachedTotal = this.mockApiTotal;
        this.emitPageResult(cached, cachedTotal, page, pageSize);
        return;
      }
      
      // Fetch from API with all parameters
      console.log('[SERVER-SIDE DEBUG] Fetching from API with params:', {
        page,
        pageSize,
        sort: this.currentSort,
        filters: this.currentFilters,
        search: this.currentSearch,
        groups: this.currentGroups
      });
      
      this.fetchMockApiPage(page, pageSize, this.currentSort, this.currentFilters, [], this.currentSearch).subscribe({
        next: ({ data, total }) => {
          this.mockApiTotal = total;
          this.mockApiCache.set(cacheKey, data);
          this.emitPageResult(data, total, page, pageSize);
        },
        error: (error) => {
          console.error('[SERVER-SIDE DEBUG] Error loading mockApi page:', error);
          this.emitPageResult([], 0, page, pageSize);
        }
      });
      return;
    }
  }

  /**
   * Fetch group metadata (distinct values and counts) - First API call for grouping
   * API Type: GROUP_METADATA - indicates this is the first API call to get unique groups
   * Now supports pagination - fetches groups page by page
   */
  private fetchGroupValues(): void {
    if (!this.currentGroups || this.currentGroups.length === 0) {
      return;
    }
    
    const groupField = this.currentGroups[0].field; // For now, handle single-level grouping
    const skip = (this.currentPage - 1) * this.pageSize;
    const metadataCacheKey = `group-metadata-${groupField}-sort${JSON.stringify(this.currentSort)}-f${JSON.stringify(this.currentFilters)}-search${this.currentSearch}-p${this.currentPage}-s${this.pageSize}`;
    
    // Check if group metadata is cached for this page
    if (this.groupMetadataCache.has(metadataCacheKey)) {
      const cached = this.groupMetadataCache.get(metadataCacheKey)!;
      this.buildGroupRowsFromMetadata(cached.metadata, cached.total);
      return;
    }
    
    console.log('[SERVER-SIDE DEBUG] First API call (GROUP_METADATA): Fetching unique group values and counts for field:', groupField, {
      page: this.currentPage,
      pageSize: this.pageSize,
      skip,
      filters: this.currentFilters,
      search: this.currentSearch
    });
    
    // First API call: Fetch group metadata with pagination, filters, and search
    this.fetchGroupMetadataAPI(groupField, this.currentSort, this.currentFilters, skip, this.pageSize, this.currentSearch).subscribe({
      next: (response) => {
        // response contains: { groups: [...], total: number, skip: number, limit: number }
        const groupMetadata = response.groups || [];
        const totalGroups = response.total || 0;
        
        // Cache the metadata for this page
        this.groupMetadataCache.set(metadataCacheKey, {
          metadata: groupMetadata,
          total: totalGroups
        });
        
        console.log('[SERVER-SIDE DEBUG] Group metadata received from API:', {
          page: this.currentPage,
          pageSize: this.pageSize,
          groupsInPage: groupMetadata.length,
          totalGroups: totalGroups,
          groups: groupMetadata.map(g => ({ value: g.value, count: g.count }))
        });
        
        // Build and emit group rows (without children)
        this.buildGroupRowsFromMetadata(groupMetadata, totalGroups);
      },
      error: (error) => {
        console.error('[SERVER-SIDE DEBUG] Error fetching group metadata:', error);
        this.emitPageResult([], 0, this.currentPage, this.pageSize);
      }
    });
  }

  /**
   * First API call: Fetch group metadata (unique values and counts) with pagination
   * Calls local server: GET /api/products/groups?groupField=...&skip=...&limit=...
   */
  private fetchGroupMetadataAPI(
    groupField: string,
    sort: SortConfig[] = [],
    filters: FilterCondition[] = [],
    skip: number = 0,
    limit: number = 10,
    search: string = ''
  ): Observable<{ groups: Array<{ value: any; key: string; count: number }>; total: number; skip: number; limit: number }> {
    // Build API URL for local server
    let url = `http://localhost:3000/api/products/groups`;
    url += `?groupField=${encodeURIComponent(groupField)}`;
    url += `&skip=${skip}`;
    url += `&limit=${limit}`;
    
    // Add sort parameters
    if (sort && sort.length > 0) {
      url += `&sortBy=${encodeURIComponent(JSON.stringify(sort))}`;
    }
    
    // Add filter parameters
    if (filters && filters.length > 0) {
      url += `&filters=${encodeURIComponent(JSON.stringify(filters))}`;
    }
    
    // Add search parameter
    if (search && search.trim()) {
      url += `&search=${encodeURIComponent(search.trim())}`;
    }
    
    console.log('[SERVER-SIDE DEBUG] GROUP_METADATA API URL:', url);
    
    return this.http.get<any>(url).pipe(
      map(resp => {
        // Server returns: { groups: [...], total: number, skip: number, limit: number }
        const metadata = resp.groups || [];
        const total = resp.total || 0;
        
        // Apply group direction sorting if needed (server already sorts, but ensure consistency)
        if (this.currentGroups && this.currentGroups.length > 0 && metadata.length > 0) {
          metadata.sort((a: any, b: any) => {
            if (this.currentGroups[0].direction === SortDirection.Desc) {
              return b.key.localeCompare(a.key);
            }
            return a.key.localeCompare(b.key);
          });
        }
        
        console.log('[SERVER-SIDE DEBUG] GROUP_METADATA API response received:', {
          groupsInPage: metadata.length,
          totalGroups: total,
          skip: resp.skip,
          limit: resp.limit
        });
        
        return {
          groups: metadata,
          total: total,
          skip: resp.skip || skip,
          limit: resp.limit || limit
        };
      })
    );
  }
  
  /**
   * Build group rows from metadata (without children) - similar to client-side grouping
   * Children are added immediately after their parent group row if cached
   * Now supports pagination - total is the total number of groups across all pages
   */
  private buildGroupRowsFromMetadata(metadata: Array<{ value: any; key: string; count: number }>, totalGroups: number = 0): void {
    if (!this.currentGroups || this.currentGroups.length === 0) {
      return;
    }
    
    const groupField = this.currentGroups[0].field;
    
    console.log('[SERVER-SIDE DEBUG] Building group rows from metadata:', {
      groupField,
      groupsInPage: metadata.length,
      totalGroups: totalGroups,
      page: this.currentPage,
      pageSize: this.pageSize,
      expandedGroups: Array.from(this.expandedGroups),
      cachedChildren: Array.from(this.groupChildrenCache.keys())
    });
    
    // Build group rows from metadata
    const groupRows: any[] = [];
    let pendingChildrenFetch = false;
    
    metadata.forEach((meta) => {
      const isExpanded = this.expandedGroups.has(meta.key);
      const groupRow: GroupRow<any> = {
        __type: GROUP_ROW_TYPE,
        level: 0,
        field: groupField,
        value: meta.value,
        key: meta.key,
        expanded: isExpanded,
        count: meta.count,
        children: [] // Children will be loaded separately when expanded
      };
      groupRows.push(groupRow);
      
      // If group is expanded, add its children IMMEDIATELY after the group row
      if (isExpanded) {
        // Build cache key that includes filters and search
        const childrenCacheKey = `${meta.key}-f${JSON.stringify(this.currentFilters)}-search${this.currentSearch}-sort${JSON.stringify(this.currentSort)}`;
        
        // Check if children are cached (from second API call)
        if (this.groupChildrenCache.has(childrenCacheKey)) {
          const children = this.groupChildrenCache.get(childrenCacheKey)!;
          console.log('[SERVER-SIDE DEBUG] Adding cached children for group:', meta.key, children.length);
          // Add children immediately after group row (this is critical for proper display)
          groupRows.push(...children);
        } else {
          // Children not loaded yet - mark that we need to fetch
          console.log('[SERVER-SIDE DEBUG] Children not cached for group:', meta.key, '- will fetch');
          pendingChildrenFetch = true;
          // Trigger second API call to fetch children
          this.fetchGroupChildren(groupField, meta.key);
        }
      }
    });
    
    console.log('[SERVER-SIDE DEBUG] Built group rows structure:', {
      totalRows: groupRows.length,
      groupRows: groupRows.filter(r => r.__type === GROUP_ROW_TYPE).length,
      dataRows: groupRows.filter(r => r.__type !== GROUP_ROW_TYPE).length,
      pendingChildrenFetch: pendingChildrenFetch,
      totalGroups: totalGroups
    });
    
    // Emit group rows (with children if expanded and cached)
    // totalGroups is the total number of groups across all pages (for pagination)
    // If children are pending, they will trigger rebuildGroupRowsWithChildren when loaded
    this.emitPageResult(groupRows, totalGroups || metadata.length, this.currentPage, this.pageSize);
  }

  /**
   * Fetch children for a specific group - Second API call for grouping
   * API Type: GROUP_CHILDREN - indicates this is the second API call to get children for a specific group
   */
  private fetchGroupChildren(groupField: string, groupValue: string): void {
    // Build cache key that includes filters and search (children depend on these)
    const childrenCacheKey = `${groupValue}-f${JSON.stringify(this.currentFilters)}-search${this.currentSearch}-sort${JSON.stringify(this.currentSort)}`;
    
    // If already cached, don't fetch again
    if (this.groupChildrenCache.has(childrenCacheKey)) {
      console.log('[SERVER-SIDE DEBUG] Children already cached for group:', groupValue, 'with current filters/search');
      this.rebuildGroupRowsWithChildren();
      return;
    }
    
    console.log('[SERVER-SIDE DEBUG] Second API call (GROUP_CHILDREN): Fetching children for group:', groupField, '=', groupValue, {
      filters: this.currentFilters,
      search: this.currentSearch
    });
    
    // Build filter for this specific group
    const groupFilter: FilterCondition = {
      field: groupField,
      operator: FilterOperator.Equals,
      value: groupValue === '(null)' ? null : groupValue
    };
    
    const allFilters = [...(this.currentFilters || []), groupFilter];
    
    // Second API call: Fetch children with API type indicator (include search)
    this.fetchGroupChildrenAPI(groupField, groupValue, this.currentSort, allFilters, this.currentSearch).subscribe({
      next: (children) => {
        this.groupChildrenCache.set(childrenCacheKey, children);
        console.log('[SERVER-SIDE DEBUG] Children fetched and cached for group:', groupValue, children.length);
        // Rebuild group rows with the new children
        this.rebuildGroupRowsWithChildren();
      },
      error: (error) => {
        console.error('[SERVER-SIDE DEBUG] Error fetching group children:', error);
      }
    });
  }

  /**
   * Second API call: Fetch children for a specific group
   * Calls local server: GET /api/products/children?groupField=...&groupValue=...
   */
  private fetchGroupChildrenAPI(
    groupField: string,
    groupValue: string,
    sort: SortConfig[] = [],
    filters: FilterCondition[] = [],
    search: string = ''
  ): Observable<any[]> {
    // Build API URL for local server
    let url = `http://localhost:3000/api/products/children`;
    url += `?groupField=${encodeURIComponent(groupField)}`;
    url += `&groupValue=${encodeURIComponent(groupValue === '(null)' ? '' : String(groupValue))}`;
    
    // Add sort parameters
    if (sort && sort.length > 0) {
      url += `&sortBy=${encodeURIComponent(JSON.stringify(sort))}`;
    }
    
    // Add filter parameters (exclude the group filter as it's already in groupValue)
    const nonGroupFilters = filters.filter(f => !(f.field === groupField && f.operator === FilterOperator.Equals));
    if (nonGroupFilters.length > 0) {
      url += `&filters=${encodeURIComponent(JSON.stringify(nonGroupFilters))}`;
    }
    
    // Add search parameter
    if (search && search.trim()) {
      url += `&search=${encodeURIComponent(search.trim())}`;
    }
    
    console.log('[SERVER-SIDE DEBUG] GROUP_CHILDREN API URL:', url);
    
    return this.http.get<any>(url).pipe(
      map(resp => {
        // Server returns: { products: [...], total: number }
        const products = resp.products || [];
        const parsedData = this.parseDates(products);
        
        console.log('[SERVER-SIDE DEBUG] GROUP_CHILDREN API response received:', {
          childrenCount: parsedData.length,
          groupField,
          groupValue
        });
        
        return parsedData;
      })
    );
  }

  /**
   * Rebuild group rows with expanded children
   */
  private rebuildGroupRowsWithChildren(): void {
    if (!this.currentGroups || this.currentGroups.length === 0) {
      return;
    }
    
    const groupField = this.currentGroups[0].field;
    const skip = (this.currentPage - 1) * this.pageSize;
    const metadataCacheKey = `group-metadata-${groupField}-sort${JSON.stringify(this.currentSort)}-f${JSON.stringify(this.currentFilters)}-p${this.currentPage}-s${this.pageSize}`;
    
    // Get cached group metadata for current page
    const cached = this.groupMetadataCache.get(metadataCacheKey);
    if (!cached) {
      // If metadata not cached, fetch it first
      this.fetchGroupValues();
      return;
    }
    
    // Rebuild group rows with children (pass total from cache)
    this.buildGroupRowsFromMetadata(cached.metadata, cached.total);
  }

  private fetchMockApiPage(
    page: number, 
    pageSize: number, 
    sort: SortConfig[] = [], 
    filters: FilterCondition[] = [], 
    groups: GroupConfig[] = [],
    search?: string
  ): Observable<{ data: any[]; total: number }> {
    const skip = (page - 1) * pageSize;
    
    // Build API URL for local server
    let url = `http://localhost:3000/api/products`;
    url += `?skip=${skip}`;
    url += `&limit=${pageSize}`;
    
    // Add sort parameters
    if (sort && sort.length > 0) {
      url += `&sortBy=${encodeURIComponent(JSON.stringify(sort))}`;
    }
    
    // Add filter parameters
    if (filters && filters.length > 0) {
      url += `&filters=${encodeURIComponent(JSON.stringify(filters))}`;
    }
    
    // Add global search parameter
    if (search && search.trim()) {
      url += `&search=${encodeURIComponent(search.trim())}`;
    }
    
    // Note: groups parameter is not needed for regular data fetching
    // Groups are handled by separate endpoints (/api/products/groups and /api/products/children)
    
    console.log('[SERVER-SIDE DEBUG] PRODUCTS API URL:', url);
    
    return this.http.get<any>(url).pipe(
      map(resp => {
        // Server returns: { products: [...], total: number, skip: number, limit: number, hasMore: boolean }
        const data = resp.products || [];
        const total = resp.total || 0;
        
        // Parse dates in the response
        const parsedData = this.parseDates(data);
        
        console.log('[SERVER-SIDE DEBUG] PRODUCTS API response:', {
          dataCount: parsedData.length,
          total,
          page,
          pageSize,
          hasMore: resp.hasMore
        });
        
        return { data: parsedData, total };
      })
    );
  }
  
  onRowClick(event: any): void {}
  onCellClick(event: any): void {}
  onSelectionChange(event: any): void {}
  onSortChange(event: SortChangeEvent): void {
    this.currentSort = event?.sort || [];
    this.currentPage = 1;
    this.triggerFetch();
  }
  /**
   * Extract global search term from filters
   * If multiple Contains filters have the same value, it's likely a global search
   */
  private extractSearchFromFilters(filters: FilterCondition[]): { isSearch: boolean; searchTerm: string; searchFields: string[] } {
    if (!filters || filters.length === 0) {
      return { isSearch: false, searchTerm: '', searchFields: [] };
    }
    
    // Find all Contains filters
    const containsFilters = filters.filter(f => f.operator === FilterOperator.Contains);
    
    if (containsFilters.length < 2) {
      // Need at least 2 Contains filters to be considered a global search
      return { isSearch: false, searchTerm: '', searchFields: [] };
    }
    
    // Check if all Contains filters have the same value
    const firstValue = containsFilters[0].value;
    const allSameValue = containsFilters.every(f => String(f.value) === String(firstValue));
    
    if (allSameValue) {
      return {
        isSearch: true,
        searchTerm: String(firstValue),
        searchFields: containsFilters.map(f => f.field)
      };
    }
    
    return { isSearch: false, searchTerm: '', searchFields: [] };
  }

  onFilterChange(event: FilterChangeEvent): void {
    // Extract search filters (Contains filters on multiple fields) vs regular filters
    const filters = event?.filters || [];
    
    // Check if filters are actually search filters (same value across multiple fields with Contains operator)
    const searchFilters = this.extractSearchFromFilters(filters);
    
    const previousSearch = this.currentSearch;
    const previousFilters = JSON.stringify(this.currentFilters);
    
    if (searchFilters.isSearch) {
      // This is a global search, not individual filters
      this.currentSearch = searchFilters.searchTerm;
      // Remove search filters from regular filters
      this.currentFilters = filters.filter(f => 
        !(f.operator === FilterOperator.Contains && 
          searchFilters.searchFields.includes(f.field) &&
          f.value === searchFilters.searchTerm)
      );
    } else {
      // Regular filters, clear search
      this.currentSearch = '';
      this.currentFilters = filters;
    }
    
    // Clear group caches when filters/search change (groups and children depend on filters/search)
    if (this.currentGroups && this.currentGroups.length > 0) {
      if (this.currentSearch !== previousSearch || JSON.stringify(this.currentFilters) !== previousFilters) {
        this.groupMetadataCache.clear();
        this.groupChildrenCache.clear();
      }
    }
    
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
    const previousGroups = [...this.currentGroups];
    this.currentGroups = event?.groups || [];
    if (event?.take) {
      this.pageSize = event.take;
    }
    if (event?.skip !== undefined && event.take) {
      this.currentPage = Math.floor(event.skip / event.take) + 1;
    }
    // Clear expanded groups and caches when groups change
    if (event?.groups && JSON.stringify(event.groups) !== JSON.stringify(previousGroups)) {
      this.expandedGroups.clear();
      this.groupChildrenCache.clear();
      this.groupMetadataCache.clear();
    }
    
    // Clear group caches when filters/search change (groups and children depend on filters/search)
    const previousFilters = JSON.stringify(this.currentFilters);
    const previousSearch = this.currentSearch;
    if (JSON.stringify(this.currentFilters) !== previousFilters || this.currentSearch !== previousSearch) {
      this.groupMetadataCache.clear();
      this.groupChildrenCache.clear();
    }
    
    this.triggerFetch();
  }
  onGroupToggle(event: GroupToggleEvent<any>): void {
    const groupKey = event.groupRow.key;
    const groupField = event.groupRow.field;
    
    if (event.expanded) {
      // Group is being expanded
      this.expandedGroups.add(groupKey);
      console.log('[SERVER-SIDE DEBUG] Group expanded:', groupKey);
      
      // Trigger second API call to fetch children for this group
      this.fetchGroupChildren(groupField, groupKey);
    } else {
      // Group is being collapsed
      this.expandedGroups.delete(groupKey);
      console.log('[SERVER-SIDE DEBUG] Group collapsed:', groupKey);
      
      // Rebuild group rows without children (children stay in cache for quick re-expansion)
      this.rebuildGroupRowsWithChildren();
    }
  }
  onEditSave(event: any): void {}
  
  getStars(rating: number): string {
    const filled = Math.floor(rating);
    const empty = 5 - filled;
    return '★'.repeat(filled) + '☆'.repeat(empty);
  }
}

