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
  isLoading = false; // Loading state for API calls
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
  private nestedGroupMetadataCache = new Map<string, { metadata: Array<{ value: any; key: string; count: number }>; total: number }>(); // Cache nested group metadata
  
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
    this.isLoading = true;
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
        this.isLoading = false;
        this.emitPageResult(data, total, initialPage, initialPageSize, false);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('[SERVER-SIDE DEBUG] Error loading mockApi data:', error);
        this.serverData = [];
        this.setupServerSideGrid(type);
        this.isLoading = false;
        this.emitPageResult([], 0, initialPage, initialPageSize, false);
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
      headerHeight: 40,
      enableSearch: true,
      searchPlaceholder: 'Search all columns...'
    };
  }
  
  private getFieldValue(obj: any, field: string): any {
    return field.split('.').reduce((o, p) => o?.[p], obj);
  }

  /**
   * Apply additional group levels using API for nested groups
   * This supports multiple group levels: first level from server, additional levels from nested-groups API
   */
  private applyAdditionalGroupLevels(children: any[], parentKey: string, currentLevel: number, parentGroupField?: string, parentGroupValue?: string): any[] {
    if (!this.currentGroups || this.currentGroups.length <= currentLevel + 1) {
      // No more group levels, return children as-is (these are data rows)
      return children;
    }

    const nextGroupLevel = currentLevel + 1;
    const nextGroupConfig = this.currentGroups[nextGroupLevel];
    const nextGroupField = nextGroupConfig.field;

    // Filter out group rows - only group actual data rows
    const dataRows = children.filter(child => !child.__type || child.__type !== GROUP_ROW_TYPE);

    // Group children by the next group field
    const grouped = new Map<string, any[]>();
    dataRows.forEach(child => {
      const value = this.getFieldValue(child, nextGroupField);
      const key = value != null ? String(value) : '(null)';
      const fullKey = parentKey ? `${parentKey}|${key}` : key;
      
      if (!grouped.has(fullKey)) {
        grouped.set(fullKey, []);
      }
      grouped.get(fullKey)!.push(child);
    });

    // Build group rows for this level
    const result: any[] = [];
    const sortedGroups = Array.from(grouped.entries()).sort((a, b) => {
      const aValue = a[0].split('|').pop()!;
      const bValue = b[0].split('|').pop()!;
      if (nextGroupConfig.direction === SortDirection.Desc) {
        return bValue.localeCompare(aValue);
      }
      return aValue.localeCompare(bValue);
    });

    for (const [fullKey, groupData] of sortedGroups) {
      const groupValue = fullKey.split('|').pop()!;
      const isExpanded = this.expandedGroups.has(fullKey);
      
      const groupRow: GroupRow<any> = {
        __type: GROUP_ROW_TYPE,
        level: nextGroupLevel,
        field: nextGroupField,
        value: groupValue === '(null)' ? null : groupValue,
        key: fullKey,
        expanded: isExpanded,
        count: groupData.length,
        children: groupData,
        parentKey: parentKey
      };
      
      result.push(groupRow);
      
      // If expanded, show children (either nested groups or data rows)
      if (isExpanded) {
        if (this.currentGroups.length > nextGroupLevel + 1) {
          // More levels to apply recursively
          const nestedRows = this.applyAdditionalGroupLevels(groupData, fullKey, nextGroupLevel);
          result.push(...nestedRows);
        } else {
          // Last level, add data rows directly
          result.push(...groupData);
        }
      }
    }

    return result;
  }

  private emitPageResult(data: any[], total: number, page: number, pageSize: number, isLoading: boolean = false): void {
    const parsed = this.parseDates(data);
    
    // If loading, emit empty data so grid shows loading indicator
    const pageResult = isLoading 
      ? { data: [], total: 0, page, pageSize }
      : { data: parsed, total, page, pageSize };
    
    console.log('[SERVER-SIDE DEBUG] emitPageResult:', {
      dataCount: parsed.length,
      total,
      page,
      pageSize,
      isLoading,
      sampleData: parsed.slice(0, 2),
      dataStreamValue: pageResult
    });
    
    this.dataStream.next(pageResult);
    this.cdr.detectChanges();
    
    console.log('[SERVER-SIDE DEBUG] Data stream updated, current value:', this.dataStream.value);
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
        this.isLoading = false;
        this.emitPageResult(cached, cachedTotal, page, pageSize, false);
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
      
      // Loading state already set by event handler, just fetch data
      // The grid will show loading indicator automatically when Observable emits
      this.fetchMockApiPage(page, pageSize, this.currentSort, this.currentFilters, [], this.currentSearch).subscribe({
        next: ({ data, total }) => {
          this.mockApiTotal = total;
          this.mockApiCache.set(cacheKey, data);
          this.isLoading = false;
          this.emitPageResult(data, total, page, pageSize, false);
        },
        error: (error) => {
          console.error('[SERVER-SIDE DEBUG] Error loading mockApi page:', error);
          this.isLoading = false;
          this.emitPageResult([], 0, page, pageSize, false);
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
    
    // For server-side grouping, we fetch the first level from the server
    // Additional levels will be applied client-side to children
    const groupField = this.currentGroups[0].field;
    const skip = (this.currentPage - 1) * this.pageSize;
    // Include all groups in cache key to handle multiple levels
    const metadataCacheKey = `group-metadata-${groupField}-groups${JSON.stringify(this.currentGroups)}-sort${JSON.stringify(this.currentSort)}-f${JSON.stringify(this.currentFilters)}-search${this.currentSearch}-p${this.currentPage}-s${this.pageSize}`;
    
    // Check if group metadata is cached for this page
    if (this.groupMetadataCache.has(metadataCacheKey)) {
      const cached = this.groupMetadataCache.get(metadataCacheKey)!;
      this.isLoading = false;
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
    
    this.isLoading = true;
    this.cdr.detectChanges();
    
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
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('[SERVER-SIDE DEBUG] Error fetching group metadata:', error);
        this.emitPageResult([], 0, this.currentPage, this.pageSize);
        this.isLoading = false;
        this.cdr.detectChanges();
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
        // Check if there are more group levels - if so, use nested-groups API
        if (this.currentGroups && this.currentGroups.length > 1) {
          // Multiple group levels - use nested-groups API for the next level
          const nextGroupField = this.currentGroups[1].field;
          const nestedMetadataCacheKey = `nested-${meta.key}-${nextGroupField}-groups${JSON.stringify(this.currentGroups)}-f${JSON.stringify(this.currentFilters)}-search${this.currentSearch}-sort${JSON.stringify(this.currentSort)}`;
          
          // Check if nested group metadata is cached
          if (this.nestedGroupMetadataCache.has(nestedMetadataCacheKey)) {
            const cached = this.nestedGroupMetadataCache.get(nestedMetadataCacheKey)!;
            console.log('[SERVER-SIDE DEBUG] Adding cached nested groups for:', meta.key, cached.metadata.length);
            // Build nested group rows from metadata (supports any number of levels)
            const nestedRows = this.buildNestedGroupRowsRecursive(
              cached.metadata,
              meta.key,
              0, // currentLevel is 0 (category level)
              nextGroupField
            );
            groupRows.push(...nestedRows);
          } else {
            // Fetch nested groups from API
            console.log('[SERVER-SIDE DEBUG] Fetching nested groups for category:', meta.key, 'grouped by:', nextGroupField);
            pendingChildrenFetch = true;
            this.isLoading = true;
            this.emitPageResult([], 0, this.currentPage, this.pageSize, true);
            
            this.fetchNestedGroupMetadataAPI(
              meta.key,
              0, // currentLevel is 0 (category level)
              nextGroupField,
              this.currentSort,
              this.currentFilters,
              this.currentSearch
            ).subscribe({
              next: (response) => {
                const metadata = response.groups || [];
                this.nestedGroupMetadataCache.set(nestedMetadataCacheKey, {
                  metadata,
                  total: response.total
                });
                this.rebuildGroupRowsWithChildren();
                this.isLoading = false;
                this.cdr.detectChanges();
              },
              error: (error) => {
                console.error('[SERVER-SIDE DEBUG] Error fetching nested group metadata:', error);
                this.isLoading = false;
                this.cdr.detectChanges();
              }
            });
          }
        } else {
          // Single group level - fetch actual children
          const childrenCacheKey = `${meta.key}-groups${JSON.stringify(this.currentGroups)}-f${JSON.stringify(this.currentFilters)}-search${this.currentSearch}-sort${JSON.stringify(this.currentSort)}`;
          
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
            this.fetchGroupChildren(groupField, meta.key, meta.key);
          }
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
   * Supports multiple group levels by applying additional levels client-side
   */
  private fetchGroupChildren(groupField: string, groupValue: string, parentKey: string = groupValue): void {
    // Build cache key that includes filters, search, and all group levels
    const childrenCacheKey = `${parentKey}-groups${JSON.stringify(this.currentGroups)}-f${JSON.stringify(this.currentFilters)}-search${this.currentSearch}-sort${JSON.stringify(this.currentSort)}`;
    
    // If already cached, don't fetch again
    if (this.groupChildrenCache.has(childrenCacheKey)) {
      console.log('[SERVER-SIDE DEBUG] Children already cached for group:', groupValue, 'with current filters/search');
      this.rebuildGroupRowsWithChildren();
      return;
    }
    
    console.log('[SERVER-SIDE DEBUG] Second API call (GROUP_CHILDREN): Fetching children for group:', groupField, '=', groupValue, {
      parentKey,
      filters: this.currentFilters,
      search: this.currentSearch,
      totalGroupLevels: this.currentGroups.length
    });
    
    // Build filters: include both parent group filter and current group filter for nested groups
    const allFilters = [...(this.currentFilters || [])];
    
    // If parentKey contains '|', it's a nested group - extract all parent group info
    if (parentKey && parentKey.includes('|')) {
      // Extract all parent filters from parentKey
      const parentSegments = parentKey.split('|');
      
      if (this.currentGroups && this.currentGroups.length > 0) {
        // Add filters for all parent groups (all segments except the last one)
        for (let i = 0; i < parentSegments.length - 1 && i < this.currentGroups.length; i++) {
          const parentGroupField = this.currentGroups[i].field;
          const parentGroupValue = parentSegments[i];
          allFilters.push({
            field: parentGroupField,
            operator: FilterOperator.Equals,
            value: parentGroupValue === '(null)' ? null : parentGroupValue
          });
          console.log('[SERVER-SIDE DEBUG] Adding parent group filter:', parentGroupField, '=', parentGroupValue);
        }
      }
    }
    
    // Add current group filter (e.g., availability = 'In Stock')
    const groupFilter: FilterCondition = {
      field: groupField,
      operator: FilterOperator.Equals,
      value: groupValue === '(null)' ? null : groupValue
    };
    allFilters.push(groupFilter);
    
    this.isLoading = true;
    this.cdr.detectChanges();
    
    // Second API call: Fetch children with API type indicator (include search)
    this.fetchGroupChildrenAPI(groupField, groupValue, this.currentSort, allFilters, this.currentSearch).subscribe({
      next: (children) => {
        // Store children directly (no additional grouping needed as this is the last level)
        this.groupChildrenCache.set(childrenCacheKey, children);
        console.log('[SERVER-SIDE DEBUG] Children fetched for group:', groupValue, {
          childrenCount: children.length,
          parentKey
        });
        // Rebuild group rows with the new children
        this.rebuildGroupRowsWithChildren();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('[SERVER-SIDE DEBUG] Error fetching group children:', error);
        this.isLoading = false;
        this.cdr.detectChanges();
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
   * Extract all parent group filters from parentKey
   * parentKey format: "value1|value2|value3" where each value corresponds to a group level
   * At level 0, parentKey is just "value1" (no | separator)
   */
  private extractParentFiltersFromKey(parentKey: string, currentLevel: number): Array<{ field: string; value: any }> {
    if (!parentKey || !this.currentGroups || this.currentGroups.length === 0) {
      return [];
    }
    
    const segments = parentKey.includes('|') ? parentKey.split('|') : [parentKey];
    const parentFilters: Array<{ field: string; value: any }> = [];
    
    // Extract filters for all parent levels (up to but not including currentLevel)
    // At level 0, we want to extract the level 0 filter itself
    // At level 1, we want to extract level 0 filter
    // At level 2, we want to extract level 0 and level 1 filters
    for (let i = 0; i < segments.length && i <= currentLevel && i < this.currentGroups.length; i++) {
      if (this.currentGroups[i]) {
        parentFilters.push({
          field: this.currentGroups[i].field,
          value: segments[i] === '(null)' ? null : segments[i]
        });
      }
    }
    
    return parentFilters;
  }

  /**
   * Recursively build nested group rows from metadata, supporting any number of levels
   */
  private buildNestedGroupRowsRecursive(
    metadata: Array<{ value: any; key: string; count: number }>,
    parentKey: string,
    currentLevel: number,
    currentGroupField: string
  ): any[] {
    if (!this.currentGroups || currentLevel >= this.currentGroups.length - 1) {
      return [];
    }

    const nestedRows: any[] = [];
    const nextLevel = currentLevel + 1;

    metadata.forEach((meta) => {
      const fullKey = parentKey ? `${parentKey}|${meta.key}` : meta.key;
      const isExpanded = this.expandedGroups.has(fullKey);
      
      const nestedGroupRow: GroupRow<any> = {
        __type: GROUP_ROW_TYPE,
        level: nextLevel,
        field: currentGroupField,
        value: meta.value,
        key: fullKey,
        expanded: isExpanded,
        count: meta.count,
        children: [],
        parentKey: parentKey
      };
      
      nestedRows.push(nestedGroupRow);
      
      // If expanded, check if there are more levels or fetch children
      if (isExpanded) {
        // Check if there are more group levels
        if (this.currentGroups && this.currentGroups.length > nextLevel + 1) {
          // More levels exist - check cache or fetch nested groups
          const nextGroupField = this.currentGroups[nextLevel + 1].field;
          const nestedMetadataCacheKey = `nested-${fullKey}-${nextGroupField}-groups${JSON.stringify(this.currentGroups)}-f${JSON.stringify(this.currentFilters)}-search${this.currentSearch}-sort${JSON.stringify(this.currentSort)}`;
          
          if (this.nestedGroupMetadataCache.has(nestedMetadataCacheKey)) {
            const cached = this.nestedGroupMetadataCache.get(nestedMetadataCacheKey)!;
            // Recursively build deeper nested groups
            const deeperRows = this.buildNestedGroupRowsRecursive(
              cached.metadata,
              fullKey,
              nextLevel,
              nextGroupField
            );
            nestedRows.push(...deeperRows);
          } else {
            // Fetch nested groups for next level
            this.isLoading = true;
            this.emitPageResult([], 0, this.currentPage, this.pageSize, true);
            
            this.fetchNestedGroupMetadataAPI(
              fullKey,
              nextLevel,
              nextGroupField,
              this.currentSort,
              this.currentFilters,
              this.currentSearch
            ).subscribe({
              next: (response) => {
                const nestedMetadata = response.groups || [];
                this.nestedGroupMetadataCache.set(nestedMetadataCacheKey, {
                  metadata: nestedMetadata,
                  total: response.total
                });
                this.rebuildGroupRowsWithChildren();
                this.isLoading = false;
                this.cdr.detectChanges();
              },
              error: (error) => {
                console.error('[SERVER-SIDE DEBUG] Error fetching nested group metadata:', error);
                this.isLoading = false;
                this.cdr.detectChanges();
              }
            });
          }
        } else {
          // Last level - fetch actual data children
          const childrenCacheKey = `${fullKey}-groups${JSON.stringify(this.currentGroups)}-f${JSON.stringify(this.currentFilters)}-search${this.currentSearch}-sort${JSON.stringify(this.currentSort)}`;
          if (this.groupChildrenCache.has(childrenCacheKey)) {
            const children = this.groupChildrenCache.get(childrenCacheKey)!;
            nestedRows.push(...children);
          } else {
            // Fetch children for this nested group
            this.fetchGroupChildren(currentGroupField, meta.key, fullKey);
          }
        }
      }
    });

    return nestedRows;
  }

  /**
   * Nested Groups API call: Fetch unique group values for a nested level, filtered by parent group(s)
   * Calls local server: GET /api/products/nested-groups?parentFilters=...&childGroupField=...
   * Supports multiple parent groups
   */
  private fetchNestedGroupMetadataAPI(
    parentKey: string,
    currentLevel: number,
    childGroupField: string,
    sort: SortConfig[] = [],
    filters: FilterCondition[] = [],
    search: string = ''
  ): Observable<{ groups: Array<{ value: any; key: string; count: number }>; total: number }> {
    // Extract all parent filters from parentKey
    const parentFilters = this.extractParentFiltersFromKey(parentKey, currentLevel);
    
    // Build API URL for local server
    let url = `http://localhost:3000/api/products/nested-groups`;
    const queryParams: string[] = [];
    
    // Add parent filters as JSON array
    if (parentFilters.length > 0) {
      queryParams.push(`parentFilters=${encodeURIComponent(JSON.stringify(parentFilters))}`);
    }
    
    queryParams.push(`childGroupField=${encodeURIComponent(childGroupField)}`);
    
    // Add sort parameters
    if (sort && sort.length > 0) {
      queryParams.push(`sortBy=${encodeURIComponent(JSON.stringify(sort))}`);
    }
    
    // Add filter parameters (exclude parent group filters as they're already in parentFilters)
    const parentGroupFields = new Set(parentFilters.map(pf => pf.field));
    const nonParentGroupFilters = filters.filter(f => 
      !(parentGroupFields.has(f.field) && f.operator === FilterOperator.Equals)
    );
    if (nonParentGroupFilters.length > 0) {
      queryParams.push(`filters=${encodeURIComponent(JSON.stringify(nonParentGroupFilters))}`);
    }
    
    // Add search parameter
    if (search && search.trim()) {
      queryParams.push(`search=${encodeURIComponent(search.trim())}`);
    }
    
    // Join all query parameters with & and add ? prefix
    if (queryParams.length > 0) {
      url += `?${queryParams.join('&')}`;
    }
    
    console.log('[SERVER-SIDE DEBUG] NESTED_GROUPS API URL:', url, {
      parentFilters,
      childGroupField,
      currentLevel
    });
    
    return this.http.get<any>(url).pipe(
      map(resp => {
        // Server returns: { groups: [...], total: number }
        const metadata = resp.groups || [];
        const total = resp.total || 0;
        
        console.log('[SERVER-SIDE DEBUG] NESTED_GROUPS API response received:', {
          groupsCount: metadata.length,
          total,
          parentFilters,
          childGroupField
        });
        
        return { groups: metadata, total };
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
    // Include all groups in cache key
    const metadataCacheKey = `group-metadata-${groupField}-groups${JSON.stringify(this.currentGroups)}-sort${JSON.stringify(this.currentSort)}-f${JSON.stringify(this.currentFilters)}-search${this.currentSearch}-p${this.currentPage}-s${this.pageSize}`;
    
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
    // Show loading immediately
    this.isLoading = true;
    this.emitPageResult([], 0, this.currentPage, this.pageSize, true);
    this.triggerFetch();
  }
  /**
   * Extract global search term from filters
   * If multiple Contains filters have the same value, it's likely a global search
   * Also check if there are many Contains filters (3+) with the same value - this is definitely a global search
   */
  private extractSearchFromFilters(filters: FilterCondition[]): { isSearch: boolean; searchTerm: string; searchFields: string[] } {
    if (!filters || filters.length === 0) {
      return { isSearch: false, searchTerm: '', searchFields: [] };
    }
    
    // Find all Contains filters
    const containsFilters = filters.filter(f => f.operator === FilterOperator.Contains);
    
    // If there are 3 or more Contains filters with the same value, it's definitely a global search
    // If there are 2+ Contains filters with the same value, it's likely a global search
    if (containsFilters.length >= 2) {
      // Group by value to find common values
      const valueGroups = new Map<string, FilterCondition[]>();
      containsFilters.forEach(f => {
        const valueKey = String(f.value || '');
        if (!valueGroups.has(valueKey)) {
          valueGroups.set(valueKey, []);
        }
        valueGroups.get(valueKey)!.push(f);
      });
      
      // Find the value that appears in the most filters
      let maxCount = 0;
      let searchValue = '';
      let searchFieldsList: string[] = [];
      
      valueGroups.forEach((filterList, value) => {
        if (filterList.length > maxCount) {
          maxCount = filterList.length;
          searchValue = value;
          searchFieldsList = filterList.map(f => f.field);
        }
      });
      
      // If 2+ filters have the same value, treat it as a global search
      if (maxCount >= 2 && searchValue) {
        return {
          isSearch: true,
          searchTerm: searchValue,
          searchFields: searchFieldsList
        };
      }
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
    
    console.log('[SERVER-SIDE DEBUG] onFilterChange:', {
      totalFilters: filters.length,
      containsFilters: filters.filter(f => f.operator === FilterOperator.Contains).length,
      searchDetected: searchFilters.isSearch,
      searchTerm: searchFilters.searchTerm,
      previousSearch: this.currentSearch
    });
    
    if (searchFilters.isSearch) {
      // This is a global search, not individual filters
      this.currentSearch = searchFilters.searchTerm;
      // Remove search filters from regular filters
      this.currentFilters = filters.filter(f => 
        !(f.operator === FilterOperator.Contains && 
          searchFilters.searchFields.includes(f.field) &&
          String(f.value) === String(searchFilters.searchTerm))
      );
      console.log('[SERVER-SIDE DEBUG] Global search detected:', {
        searchTerm: this.currentSearch,
        remainingFilters: this.currentFilters.length
      });
    } else {
      // Regular filters, clear search
      this.currentSearch = '';
      this.currentFilters = filters;
      console.log('[SERVER-SIDE DEBUG] Regular filters, search cleared');
    }
    
    // Clear cache when search/filters change (to ensure fresh data)
    if (this.currentSearch !== previousSearch || JSON.stringify(this.currentFilters) !== previousFilters) {
      console.log('[SERVER-SIDE DEBUG] Clearing cache due to search/filter change');
      this.mockApiCache.clear();
      
        // Clear group caches when filters/search change (groups and children depend on filters/search)
        if (this.currentGroups && this.currentGroups.length > 0) {
          this.groupMetadataCache.clear();
          this.groupChildrenCache.clear();
          this.nestedGroupMetadataCache.clear();
        }
    }
    
    this.currentPage = 1;
    // Show loading immediately
    this.isLoading = true;
    this.emitPageResult([], 0, this.currentPage, this.pageSize, true);
    this.triggerFetch();
  }
  onPageChange(event: PageChangeEvent): void {
    this.currentPage = event?.page || 1;
    this.pageSize = event?.pageSize || this.pageSize;
    // Show loading immediately
    this.isLoading = true;
    this.emitPageResult([], 0, this.currentPage, this.pageSize, true);
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
      this.nestedGroupMetadataCache.clear();
    }
    
    // Clear group caches when filters/search change (groups and children depend on filters/search)
    const previousFilters = JSON.stringify(this.currentFilters);
    const previousSearch = this.currentSearch;
    if (JSON.stringify(this.currentFilters) !== previousFilters || this.currentSearch !== previousSearch) {
      this.groupMetadataCache.clear();
      this.groupChildrenCache.clear();
      this.nestedGroupMetadataCache.clear();
    }
    
    this.triggerFetch();
  }
  onGroupToggle(event: GroupToggleEvent<any>): void {
    const groupKey = event.groupRow.key;
    const groupField = event.groupRow.field;
    const groupLevel = event.groupRow.level;
    const parentKey = event.groupRow.parentKey;
    const groupValue = event.groupRow.value;
    
    if (event.expanded) {
      // Group is being expanded
      this.expandedGroups.add(groupKey);
      console.log('[SERVER-SIDE DEBUG] Group expanded:', {
        key: groupKey,
        field: groupField,
        level: groupLevel,
        parentKey: parentKey,
        value: groupValue
      });
      
      // For level 0 groups, check if there are more levels
      if (groupLevel === 0) {
        // If there are more group levels, use nested-groups API
        if (this.currentGroups && this.currentGroups.length > 1) {
          const nextGroupField = this.currentGroups[1].field;
          this.isLoading = true;
          this.emitPageResult([], 0, this.currentPage, this.pageSize, true);
          
          this.fetchNestedGroupMetadataAPI(
            groupKey,
            groupLevel,
            nextGroupField,
            this.currentSort,
            this.currentFilters,
            this.currentSearch
          ).subscribe({
            next: (response) => {
              const metadata = response.groups || [];
              const nestedMetadataCacheKey = `nested-${groupKey}-${nextGroupField}-groups${JSON.stringify(this.currentGroups)}-f${JSON.stringify(this.currentFilters)}-search${this.currentSearch}-sort${JSON.stringify(this.currentSort)}`;
              this.nestedGroupMetadataCache.set(nestedMetadataCacheKey, {
                metadata,
                total: response.total
              });
              this.rebuildGroupRowsWithChildren();
              this.isLoading = false;
              this.cdr.detectChanges();
            },
            error: (error) => {
              console.error('[SERVER-SIDE DEBUG] Error fetching nested group metadata:', error);
              this.isLoading = false;
              this.cdr.detectChanges();
            }
          });
        } else {
          // Single level - fetch actual children
          this.fetchGroupChildren(groupField, groupKey, groupKey);
        }
      } else if (this.currentGroups && this.currentGroups.length > groupLevel + 1) {
        // Nested group with more levels - fetch nested group metadata from API
        const parentGroupField = this.currentGroups[groupLevel - 1]?.field;
        const parentGroupValue = parentKey ? parentKey.split('|').pop() : undefined;
        
        if (parentGroupField && parentGroupValue !== undefined) {
          // Fetch nested groups for this level
          this.isLoading = true;
          this.emitPageResult([], 0, this.currentPage, this.pageSize, true);
          
          const nextGroupField = this.currentGroups[groupLevel + 1].field;
          this.fetchNestedGroupMetadataAPI(
            groupKey,
            groupLevel,
            nextGroupField,
            this.currentSort,
            this.currentFilters,
            this.currentSearch
          ).subscribe({
            next: (response) => {
              const metadata = response.groups || [];
              const nestedMetadataCacheKey = `nested-${groupKey}-${nextGroupField}-groups${JSON.stringify(this.currentGroups)}-f${JSON.stringify(this.currentFilters)}-search${this.currentSearch}-sort${JSON.stringify(this.currentSort)}`;
              this.nestedGroupMetadataCache.set(nestedMetadataCacheKey, {
                metadata,
                total: response.total
              });
              this.rebuildGroupRowsWithChildren();
              this.isLoading = false;
              this.cdr.detectChanges();
            },
            error: (error) => {
              console.error('[SERVER-SIDE DEBUG] Error fetching nested group metadata:', error);
              this.isLoading = false;
              this.cdr.detectChanges();
            }
          });
        } else {
          // Last level - fetch actual data children (filtered by parent groups)
          this.fetchGroupChildren(groupField, groupValue === null ? '(null)' : String(groupValue), groupKey);
        }
      } else {
        // Last level - fetch actual data children
        this.fetchGroupChildren(groupField, groupValue === null ? '(null)' : String(groupValue), groupKey);
      }
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

