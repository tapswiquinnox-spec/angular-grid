import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, TemplateRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  ColumnType,
  DataStateChangeEvent,
  EditMode,
  FilterChangeEvent,
  FilterCondition,
  FilterOperator,
  GridOptions,
  GroupConfig,
  GroupRow,
  GroupToggleEvent,
  GROUP_ROW_TYPE,
  LoadMoreEvent,
  ExportRequestEvent,
  PageChangeEvent,
  PageResult,
  SelectionMode,
  SortChangeEvent,
  SortConfig,
  SortDirection
} from '../../../../../projects/ng-data-grid/src/public-api';
import {
  GroupChildrenRequest,
  GroupMetadataRequest,
  NestedGroupsRequest,
  ProductsPageRequest,
  ServerDemoApiRequest,
  ServerDemoApiResponse
} from './server-demo.types';


/**
 * Child component that handles ALL grid logic, state, caching, and UI.
 * Parent (server-demo) only handles API calls.
 */
@Component({
  selector: 'app-server-grid',
  templateUrl: './server-grid.component.html',
  styleUrls: ['./server-grid.component.css']
})
export class ServerGridComponent implements OnInit, OnDestroy {
  @ViewChild('statusTemplate', { static: true }) statusTemplate!: TemplateRef<any>;
  @ViewChild('ratingTemplate', { static: true }) ratingTemplate!: TemplateRef<any>;
  @ViewChild('payloadTemplate', { static: true }) payloadTemplate!: TemplateRef<any>;
  @ViewChild('dataGrid', { static: false }) dataGridRef!: any; // Reference to lib-data-grid component
  
  @Input() apiResponses$!: Observable<ServerDemoApiResponse>;
  @Output() apiRequest = new EventEmitter<ServerDemoApiRequest>();

  // UI state
  isLoading = false;
  gridOptions: GridOptions<any> | null = null;
  
  // Payload popup state
  showPayloadPopup = false;
  currentPayload: any = null;

  // Data/state
  private serverData: any[] = [];
  private dataStream = new BehaviorSubject<PageResult<any>>({ data: [], total: 0, page: 1, pageSize: 10 });
  private mockApiTotal = 0;
  private currentPage = 1;
  private pageSize = 10;
  private currentSort: SortConfig[] = [];
  private currentFilters: FilterCondition[] = [];
  private currentGroups: GroupConfig[] = [];
  private currentSearch = '';

  private expandedGroups = new Set<string>();
  private groupChildrenCache = new Map<string, any[]>();
  private groupMetadataCache = new Map<string, { metadata: Array<{ value: any; key: string; count: number }>; total: number }>();
  private nestedGroupMetadataCache = new Map<string, { metadata: Array<{ value: any; key: string; count: number }>; total: number }>();
  private groupChildrenPagination = new Map<string, { page: number; pageSize: number; total: number; hasMore: boolean }>();
  private pendingNestedGroupRequests = new Set<string>(); // Track pending nested group API requests

  private readonly LOAD_MORE_ROW_TYPE = '__LOAD_MORE_ROW__';
  private readonly destroy$ = new Subject<void>();

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    // Handle parent API responses
    this.apiResponses$
      .pipe(takeUntil(this.destroy$))
      .subscribe((resp: ServerDemoApiResponse) => this.handleApiResponse(resp));

    // Ensure initial page size is 10 (override any persisted settings)
    this.pageSize = 10;
    
    // Clear persisted pageSize from localStorage to ensure initial pageSize is 10
    // The grid will load other persisted settings (column widths, order, etc.) but pageSize will be 10
    try {
      const settingsKey = 'ng-data-grid-server-side-grid-products';
      const stored = localStorage.getItem(settingsKey);
      if (stored) {
        const settings = JSON.parse(stored);
        if (settings.pageSize && settings.pageSize !== 10) {
          // Remove pageSize from persisted settings so defaultPageSize (10) is used
          delete settings.pageSize;
          localStorage.setItem(settingsKey, JSON.stringify(settings));
        }
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    
    // Initial load
    this.isLoading = true;
    this.emitPageResult([], 0, 1, this.pageSize, true);
    this.requestProductsPage({ page: 1, pageSize: this.pageSize, sort: [], filters: [], groups: [], search: '' });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // -------------------------
  // Grid Event Handlers (from lib-data-grid)
  // -------------------------

  onSortChange(event: SortChangeEvent): void {
    this.currentSort = event?.sort || [];
    this.isLoading = true;
    this.emitPageResult([], 0, 1, this.pageSize, true);
    this.resetGridPageTo1();
    this.triggerFetch();
  }

  onFilterChange(event: FilterChangeEvent): void {
    const filters = event?.filters || [];
    const search = this.extractSearchFromFilters(filters);

    const prevSearch = this.currentSearch;
    const prevFilters = JSON.stringify(this.currentFilters);

    if (search.isSearch) {
      this.currentSearch = search.searchTerm;
      this.currentFilters = filters.filter(f => !(f.operator === FilterOperator.Contains && String(f.value || '') === search.searchTerm));
    } else {
      this.currentSearch = '';
      this.currentFilters = filters;
    }

    if (prevSearch !== this.currentSearch || prevFilters !== JSON.stringify(this.currentFilters)) {
      this.clearCaches();
    }

    this.isLoading = true;
    this.emitPageResult([], 0, 1, this.pageSize, true);
    this.resetGridPageTo1();
    this.triggerFetch();
  }

  onPageChange(event: PageChangeEvent): void {
    this.currentPage = event.page;
    // On initial load, ensure pageSize is 10 (override any persisted settings)
    if (this.currentPage === 1 && !this.serverData.length) {
      this.pageSize = 10;
    } else {
      this.pageSize = event.pageSize;
    }
    this.isLoading = true;
    this.emitPageResult([], 0, this.currentPage, this.pageSize, true);
    this.triggerFetch();
  }

  onDataStateChange(event: DataStateChangeEvent): void {
    const previousSort = JSON.stringify(this.currentSort);
    const previousFilters = JSON.stringify(this.currentFilters);
    const previousGroups = [...this.currentGroups];
    
    this.currentSort = event?.sort || [];
    this.currentFilters = event?.filters || [];
    this.currentGroups = event?.groups || [];
    
    // Check if filters or sort changed - if so, reset to page 1
    const filtersChanged = JSON.stringify(this.currentFilters) !== previousFilters;
    const sortChanged = JSON.stringify(this.currentSort) !== previousSort;
    
    if (event?.take) {
      // On initial load (first data state change), ensure pageSize is 10
      if (this.currentPage === 1 && !this.serverData.length && this.currentGroups.length === 0) {
        this.pageSize = 10;
      } else {
        this.pageSize = event.take;
      }
    }
    
    // Reset to page 1 if filters or sort changed
    if (filtersChanged || sortChanged) {
      // Emit empty result with page 1 immediately so grid UI updates
      this.isLoading = true;
      this.emitPageResult([], 0, 1, this.pageSize, true);
      this.resetGridPageTo1();
    } else if (event?.skip !== undefined && event.take) {
      // Only update page from event if filters/sort didn't change
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
    const previousSearch = this.currentSearch;
    if (filtersChanged || this.currentSearch !== previousSearch) {
      this.groupMetadataCache.clear();
      this.groupChildrenCache.clear();
      this.nestedGroupMetadataCache.clear();
    }
    
    // Extract search from filters if filters changed
    if (filtersChanged) {
      const search = this.extractSearchFromFilters(this.currentFilters);
      if (search.isSearch) {
        this.currentSearch = search.searchTerm;
        this.currentFilters = this.currentFilters.filter(f => 
          !(f.operator === FilterOperator.Contains && 
            search.searchFields.includes(f.field) &&
            String(f.value) === String(search.searchTerm))
        );
      } else {
        this.currentSearch = '';
      }
    }
    
    this.triggerFetch();
  }

  onGroupToggle(event: GroupToggleEvent<any>): void {
    const groupRow = event.groupRow as any;
    const groupKey = groupRow?.key || groupRow?.groupKey;
    const groupField = groupRow?.field;
    const groupLevel = groupRow?.level || 0;
    const parentKey = groupRow?.parentKey;
    const groupValue = groupRow?.value;
    
    if (!groupKey) return;
    
    if (event.expanded) {
      // Group is being expanded
      this.expandedGroups.add(groupKey);
      
      // For level 0 groups, check if there are more levels
      if (groupLevel === 0) {
        // If there are more group levels, use nested-groups API
        if (this.currentGroups && this.currentGroups.length > 1) {
          const nextGroupField = this.currentGroups[1].field;
          // Generate cache key for nested groups
          const nestedMetadataCacheKey = `nested-${groupKey}-${nextGroupField}-groups${JSON.stringify(this.currentGroups)}-f${JSON.stringify(this.currentFilters)}-search${this.currentSearch}-sort${JSON.stringify(this.currentSort)}`;
          
          // Check if already pending
          if (this.pendingNestedGroupRequests.has(nestedMetadataCacheKey)) {
            return; // Already requested, don't make duplicate call
          }
          
          this.isLoading = true;
          this.emitPageResult([], 0, this.currentPage, this.pageSize, true);
          
          // Mark as pending
          this.pendingNestedGroupRequests.add(nestedMetadataCacheKey);
          
          const parentFilters = this.extractParentFiltersFromKey(groupKey, groupLevel);
          this.requestNestedGroups({
            parentFilters,
            childGroupField: nextGroupField,
            cacheKey: nestedMetadataCacheKey, // Pass the cache key
            sort: this.currentSort,
            filters: this.currentFilters,
            search: this.currentSearch
          });
          return;
        } else {
          // Single level - fetch actual children
          this.fetchGroupChildren(groupField, groupKey, groupKey, 1, this.pageSize);
          return;
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
          const parentFilters = this.extractParentFiltersFromKey(groupKey, groupLevel);
          // Generate cache key for nested groups
          const nestedMetadataCacheKey = `nested-${groupKey}-${nextGroupField}-groups${JSON.stringify(this.currentGroups)}-f${JSON.stringify(this.currentFilters)}-search${this.currentSearch}-sort${JSON.stringify(this.currentSort)}`;
          
          // Check if already pending
          if (this.pendingNestedGroupRequests.has(nestedMetadataCacheKey)) {
            return; // Already requested, don't make duplicate call
          }
          
          // Mark as pending
          this.pendingNestedGroupRequests.add(nestedMetadataCacheKey);
          
          this.requestNestedGroups({
            parentFilters,
            childGroupField: nextGroupField,
            cacheKey: nestedMetadataCacheKey, // Pass the cache key
            sort: this.currentSort,
            filters: this.currentFilters,
            search: this.currentSearch
          });
          return;
        } else {
          // Last level - fetch actual data children (filtered by parent groups)
          this.fetchGroupChildren(groupField, groupValue === null ? '(null)' : String(groupValue), groupKey, 1, this.pageSize);
          return;
        }
      } else {
        // Last level - fetch actual data children
        this.fetchGroupChildren(groupField, groupValue === null ? '(null)' : String(groupValue), groupKey, 1, this.pageSize);
        return;
      }
    } else {
      // Group is being collapsed
      this.expandedGroups.delete(groupKey);
      
      // Rebuild group rows without children (children stay in cache for quick re-expansion)
      this.rebuildGroupRowsWithChildren();
    }
  }

  onLoadMore(event: LoadMoreEvent): void {
    this.loadMoreGroupChildren(event.groupKey, event.groupField, event.groupValue, event.parentKey);
  }

  onExportRequest(event: ExportRequestEvent): void {
    this.emitRequest('export', event);
  }


  getStars(rating: number): string {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    let stars = '★'.repeat(fullStars);
    if (hasHalfStar) {
      stars += '½';
    }
    const emptyStars = 5 - Math.ceil(rating);
    stars += '☆'.repeat(emptyStars);
    return stars;
  }

  /**
   * Helper method to reset grid's internal page state to 1
   * This ensures the grid UI shows page 1 when filters/sort change
   */
  private resetGridPageTo1(): void {
    this.currentPage = 1;
    // Programmatically trigger the grid's page change to update its internal state
    // This is necessary because the grid uses its state service's page, not the PageResult page
    if (this.dataGridRef && typeof this.dataGridRef.onPageChange === 'function') {
      // Use setTimeout to ensure this happens after the current change detection cycle
      setTimeout(() => {
        if (this.dataGridRef && typeof this.dataGridRef.onPageChange === 'function') {
          this.dataGridRef.onPageChange(1);
        }
      }, 0);
    }
  }

  // -------------------------
  // API Request Helpers
  // -------------------------
  private emitRequest(eventType: ServerDemoApiRequest['eventType'], eventData: any): string {
    const requestId = `${eventType}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    this.apiRequest.emit({ requestId, eventType, eventData });
    return requestId;
  }

  private requestProductsPage(req: ProductsPageRequest): void {
    this.emitRequest('productsPage', req);
  }

  private requestGroupMetadata(req: GroupMetadataRequest): void {
    this.emitRequest('groupMetadata', req);
  }

  private requestGroupChildren(req: GroupChildrenRequest): void {
    this.emitRequest('groupChildren', req);
  }

  private requestNestedGroups(req: NestedGroupsRequest): void {
    this.emitRequest('nestedGroups', req);
  }

  // -------------------------
  // API Response Handler
  // -------------------------
  private handleApiResponse(resp: ServerDemoApiResponse): void {
    switch (resp.eventType) {
      case 'productsPage': {
        const { data, total } = resp.data || { data: [], total: 0 };
        this.mockApiTotal = total;
        this.serverData = this.parseDates(data || []);
        if (!this.gridOptions) {
          this.setupServerSideGrid();
          // Ensure pageSize is 10 after grid setup (in case persisted settings changed it)
          this.pageSize = 10;
        }
        // Always use currentPage (which should be 1 when filters change) to ensure grid UI shows correct page
        this.emitPageResult(this.serverData, this.mockApiTotal, this.currentPage, this.pageSize, false);
        this.isLoading = false;
        return;
      }
      case 'groupMetadata': {
        const { groupField, skip } = resp.data?.request || {};
        const response = resp.data?.response;
        if (!groupField || !response) return;
        // Match the cache key format used in fetchGroupValues
        const metadataCacheKey = `group-metadata-${groupField}-groups${JSON.stringify(this.currentGroups)}-sort${JSON.stringify(this.currentSort)}-f${JSON.stringify(this.currentFilters)}-search${this.currentSearch}-p${this.currentPage}-s${this.pageSize}`;
        this.groupMetadataCache.set(metadataCacheKey, { metadata: response.groups || [], total: response.total || 0 });
        this.rebuildGroupRowsWithChildren();
        this.isLoading = false;
        return;
      }
      case 'groupChildren': {
        const { request, children, total, hasMore, page, pageSize } = resp.data || {};
        if (!request) return;
        
        // Build cache key the same way as fetchGroupChildren does
        // Use parentKey from request, or fallback to groupValue (for level 0 groups)
        const parentKey = request.parentKey || request.groupValue;
        const childrenCacheKey = `${parentKey}-groups${JSON.stringify(this.currentGroups)}-f${JSON.stringify(this.currentFilters)}-search${this.currentSearch}-sort${JSON.stringify(this.currentSort)}`;
        
        // Parse dates for children
        const parsedChildren = this.parseDates(children || []);
        
        // For pagination: merge with existing if page > 1, otherwise replace
        const existing = this.groupChildrenCache.get(childrenCacheKey) || [];
        const merged = page && page > 1 ? [...existing, ...parsedChildren] : parsedChildren;
        
        // Store children directly (no additional grouping needed as this is the last level)
        // This matches the previous code behavior
        this.groupChildrenCache.set(childrenCacheKey, merged);
        
        // Update pagination state (for Load More functionality)
        if (page && pageSize) {
          this.groupChildrenPagination.set(childrenCacheKey, { 
            page: page, 
            pageSize: pageSize, 
            total: total || merged.length, 
            hasMore: !!hasMore 
          });
        }
        
        // Rebuild group rows with the new children
        this.rebuildGroupRowsWithChildren();
        this.isLoading = false;
        return;
      }
      case 'nestedGroups': {
        const { cacheKey, metadata, total } = resp.data || {};
        if (!cacheKey) return;
        this.nestedGroupMetadataCache.set(cacheKey, { metadata: metadata || [], total: total || 0 });
        // Remove from pending requests
        this.pendingNestedGroupRequests.delete(cacheKey);
        this.rebuildGroupRowsWithChildren();
        this.isLoading = false;
        return;
      }
    }
  }

  // -------------------------
  // Core Logic Methods
  // -------------------------
  private triggerFetch(): void {
    // Ensure we're using the correct currentPage (should be 1 if filters/sort changed)
    const pageToFetch = this.currentPage;
    
    if (this.currentGroups?.length) {
      this.fetchGroupValues();
    } else {
      this.requestProductsPage({ page: pageToFetch, pageSize: this.pageSize, sort: this.currentSort, filters: this.currentFilters, groups: [], search: this.currentSearch });
    }
  }

  private fetchGroupValues(): void {
    if (!this.currentGroups || this.currentGroups.length === 0) return;
    
    const groupField = this.currentGroups[0].field;
    const skip = (this.currentPage - 1) * this.pageSize;
    const metadataCacheKey = `group-metadata-${groupField}-groups${JSON.stringify(this.currentGroups)}-sort${JSON.stringify(this.currentSort)}-f${JSON.stringify(this.currentFilters)}-search${this.currentSearch}-p${this.currentPage}-s${this.pageSize}`;
    
    if (this.groupMetadataCache.has(metadataCacheKey)) {
      const cached = this.groupMetadataCache.get(metadataCacheKey)!;
      this.isLoading = false;
      this.buildGroupRowsFromMetadata(cached.metadata, cached.total);
      return;
    }
    
    this.isLoading = true;
    this.requestGroupMetadata({ groupField, sort: this.currentSort, filters: this.currentFilters, search: this.currentSearch, skip, limit: this.pageSize });
  }

  private buildGroupRowsFromMetadata(metadata: Array<{ value: any; key: string; count: number }>, totalGroups: number = 0): void {
    if (!this.currentGroups || this.currentGroups.length === 0) return;
    
    const groupField = this.currentGroups[0].field;
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
        expanded: isExpanded ? true : false, // Explicitly set to false if not expanded
        count: meta.count,
        children: []
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
            // Build nested group rows from metadata (supports any number of levels)
            const nestedRows = this.buildNestedGroupRowsRecursive(
              cached.metadata,
              meta.key,
              0, // currentLevel is 0 (category level)
              nextGroupField
            );
            groupRows.push(...nestedRows);
          } else if (!this.pendingNestedGroupRequests.has(nestedMetadataCacheKey)) {
            // Fetch nested groups from API only if not already pending
            pendingChildrenFetch = true;
            this.isLoading = true;
            this.emitPageResult([], 0, this.currentPage, this.pageSize, true);
            
            // Mark as pending
            this.pendingNestedGroupRequests.add(nestedMetadataCacheKey);
            
            const parentFilters = this.extractParentFiltersFromKey(meta.key, 0);
            this.requestNestedGroups({
              parentFilters,
              childGroupField: nextGroupField,
              cacheKey: nestedMetadataCacheKey, // Pass the cache key
              sort: this.currentSort,
              filters: this.currentFilters,
              search: this.currentSearch
            });
          }
        } else {
          // Single group level - fetch actual children
          const childrenCacheKey = `${meta.key}-groups${JSON.stringify(this.currentGroups)}-f${JSON.stringify(this.currentFilters)}-search${this.currentSearch}-sort${JSON.stringify(this.currentSort)}`;
          
          // Check if children are cached (from second API call)
          if (this.groupChildrenCache.has(childrenCacheKey)) {
            const children = this.groupChildrenCache.get(childrenCacheKey)!;
            // Add children immediately after group row (this is critical for proper display)
            groupRows.push(...children);
            
            // Check for pagination
            const paginationState = this.groupChildrenPagination.get(childrenCacheKey);
            if (paginationState && paginationState.hasMore) {
              groupRows.push({
                __type: this.LOAD_MORE_ROW_TYPE,
                groupKey: meta.key,
                groupField: groupField,
                groupValue: meta.value,
                parentKey: meta.key,
                loaded: paginationState.page * paginationState.pageSize,
                total: paginationState.total
              });
            }
          } else {
            // Children not loaded yet - mark that we need to fetch
            pendingChildrenFetch = true;
            // Trigger second API call to fetch children
            this.fetchGroupChildren(groupField, meta.key, meta.key, 1, this.pageSize);
          }
        }
      }
    });
    
    // Emit group rows (with children if expanded and cached)
    // totalGroups is the total number of groups across all pages (for pagination)
    // If children are pending, they will trigger rebuildGroupRowsWithChildren when loaded
    this.emitPageResult(groupRows, totalGroups || metadata.length, this.currentPage, this.pageSize);
  }

  private fetchGroupChildren(groupField: string, groupValue: string, parentKey: string = groupValue, page: number = 1, pageSize: number = 10): void {
    // Build cache key that includes filters, search, and all group levels
    const childrenCacheKey = `${parentKey}-groups${JSON.stringify(this.currentGroups)}-f${JSON.stringify(this.currentFilters)}-search${this.currentSearch}-sort${JSON.stringify(this.currentSort)}`;
    
    // If already cached, don't fetch again (for first page)
    if (this.groupChildrenCache.has(childrenCacheKey) && page === 1) {
      this.rebuildGroupRowsWithChildren();
      return;
    }
    
    // Check pagination for subsequent pages
    if (page > 1) {
      const cachedChildren = this.groupChildrenCache.get(childrenCacheKey);
      const paginationState = this.groupChildrenPagination.get(childrenCacheKey);
      if (cachedChildren && paginationState && paginationState.page >= page) {
        this.rebuildGroupRowsWithChildren();
        return;
      }
    }
    
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
    
    const skip = (page - 1) * pageSize;
    
    this.isLoading = true;
    this.requestGroupChildren({
      groupField,
      groupValue: groupValue === '(null)' ? '(null)' : String(groupValue),
      parentKey: parentKey, // Include parentKey in request
      sort: this.currentSort,
      filters: allFilters,
      search: this.currentSearch,
      skip,
      limit: pageSize
    });
  }

  private loadMoreGroupChildren(groupKey: string, groupField: string, groupValue: any, parentKey: string): void {
    const cacheKey = `${parentKey}-groups${JSON.stringify(this.currentGroups)}-f${JSON.stringify(this.currentFilters)}-search${this.currentSearch}-sort${JSON.stringify(this.currentSort)}`;
    const state = this.groupChildrenPagination.get(cacheKey);
    const nextPage = (state?.page || 1) + 1;
    const pageSize = state?.pageSize || this.pageSize;
    const skip = (nextPage - 1) * pageSize;
    this.isLoading = true;
    this.requestGroupChildren({
      groupField,
      groupValue: groupValue === null ? '(null)' : String(groupValue),
      parentKey: parentKey, // Include parentKey in request
      sort: this.currentSort,
      filters: this.currentFilters,
      search: this.currentSearch,
      skip,
      limit: pageSize
    });
  }

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
        expanded: isExpanded ? true : false, // Explicitly set to false if not expanded
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
          } else if (!this.pendingNestedGroupRequests.has(nestedMetadataCacheKey)) {
            // Fetch nested groups for next level only if not already pending
            this.isLoading = true;
            this.emitPageResult([], 0, this.currentPage, this.pageSize, true);
            
            // Mark as pending
            this.pendingNestedGroupRequests.add(nestedMetadataCacheKey);
            
            const parentFilters = this.extractParentFiltersFromKey(fullKey, nextLevel);
            this.requestNestedGroups({
              parentFilters,
              childGroupField: nextGroupField,
              cacheKey: nestedMetadataCacheKey, // Pass the cache key
              sort: this.currentSort,
              filters: this.currentFilters,
              search: this.currentSearch
            });
          }
        } else {
          // Last level - fetch actual data children
          const childrenCacheKey = `${fullKey}-groups${JSON.stringify(this.currentGroups)}-f${JSON.stringify(this.currentFilters)}-search${this.currentSearch}-sort${JSON.stringify(this.currentSort)}`;
          if (this.groupChildrenCache.has(childrenCacheKey)) {
            const children = this.groupChildrenCache.get(childrenCacheKey)!;
            nestedRows.push(...children);
            
            // Check for pagination
            const paginationState = this.groupChildrenPagination.get(childrenCacheKey);
            if (paginationState && paginationState.hasMore) {
              nestedRows.push({
                __type: this.LOAD_MORE_ROW_TYPE,
                groupKey: fullKey,
                groupField: currentGroupField,
                groupValue: meta.value,
                parentKey: parentKey,
                loaded: paginationState.page * paginationState.pageSize,
                total: paginationState.total
              });
            }
          } else {
            // Fetch children for this nested group
            this.fetchGroupChildren(currentGroupField, meta.key, fullKey, 1, this.pageSize);
          }
        }
      }
    });

    return nestedRows;
  }

  private extractParentFiltersFromKey(parentKey: string, currentLevel: number): Array<{ field: string; value: any }> {
    if (!parentKey || !this.currentGroups || this.currentGroups.length === 0) {
      return [];
    }
    
    const segments = parentKey.includes('|') ? parentKey.split('|') : [parentKey];
    const parentFilters: Array<{ field: string; value: any }> = [];
    
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

  private rebuildGroupRowsWithChildren(): void {
    if (!this.currentGroups || this.currentGroups.length === 0) {
      return;
    }
    
    const groupField = this.currentGroups[0].field;
    const skip = (this.currentPage - 1) * this.pageSize;
    const metadataCacheKey = `group-metadata-${groupField}-groups${JSON.stringify(this.currentGroups)}-sort${JSON.stringify(this.currentSort)}-f${JSON.stringify(this.currentFilters)}-search${this.currentSearch}-p${this.currentPage}-s${this.pageSize}`;
    
    const cached = this.groupMetadataCache.get(metadataCacheKey);
    if (!cached) {
      this.fetchGroupValues();
      return;
    }
    
    this.buildGroupRowsFromMetadata(cached.metadata, cached.total);
  }

  // -------------------------
  // Utility Methods
  // -------------------------
  private emitPageResult(data: any[], total: number, page: number, pageSize: number, isLoading: boolean = false): void {
    const parsed = this.parseDates(data);
    
    // If loading, emit empty data so grid shows loading indicator
    const pageResult = isLoading 
      ? { data: [], total: 0, page, pageSize }
      : { data: parsed, total, page, pageSize };
    
    this.dataStream.next(pageResult);
  }

  private clearCaches(): void {
    // Clear group caches when filters/search change (groups and children depend on filters/search)
    if (this.currentGroups && this.currentGroups.length > 0) {
      this.groupMetadataCache.clear();
      this.groupChildrenCache.clear();
      this.nestedGroupMetadataCache.clear();
      this.pendingNestedGroupRequests.clear(); // Clear pending requests when caches are cleared
    }
  }

  private extractSearchFromFilters(filters: FilterCondition[]): { isSearch: boolean; searchTerm: string; searchFields: string[] } {
    if (!filters?.length) return { isSearch: false, searchTerm: '', searchFields: [] };
    const contains = filters.filter(f => f.operator === FilterOperator.Contains);
    if (contains.length >= 2) {
      const groups = new Map<string, FilterCondition[]>();
      for (const f of contains) {
        const k = String(f.value || '');
        groups.set(k, [...(groups.get(k) || []), f]);
      }
      let max = 0;
      let val = '';
      let fields: string[] = [];
      groups.forEach((list, key) => {
        if (list.length > max) {
          max = list.length;
          val = key;
          fields = list.map(x => x.field);
        }
      });
      if (max >= 2 && val) return { isSearch: true, searchTerm: val, searchFields: fields };
    }
    return { isSearch: false, searchTerm: '', searchFields: [] };
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
    if (!data || data.length === 0) return [];
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
      
      if (field === 'active' || field === 'isActive') {
        column.cellTemplate = this.statusTemplate;
      }
      
      if (field === 'rating') {
        column.cellTemplate = this.ratingTemplate;
      }
      
      // Handle payload column - pin to right and use icon template
      if (field === 'payload' || field === 'rawData' || field === 'data') {
        column.cellTemplate = this.payloadTemplate;
        column.width = 100;
        column.sortable = false;
        column.filterable = true;
        column.align = 'center';
        column.pinned = 'right';
        column.title = 'Payload';
      } else if (index === 0 || field.toLowerCase().includes('id') || field.toLowerCase().includes('name') || field.toLowerCase().includes('code')) {
        // Pin important fields to left (but not payload)
        column.pinned = 'left';
      }
      
      columns.push(column);
    });
    
    return columns;
  }

  private detectColumnType(value: any): ColumnType {
    if (value == null) return ColumnType.String;
    if (typeof value === 'number') return ColumnType.Number;
    if (typeof value === 'boolean') return ColumnType.Boolean;
    if (value instanceof Date) return ColumnType.Date;
    if (typeof value === 'string' && this.isDateString(value)) return ColumnType.Date;
    return ColumnType.String;
  }

  private calculateColumnWidth(field: string, type: ColumnType, sampleValue: any): number {
    const fieldNameLength = field.length;
    const baseWidth = Math.max(100, fieldNameLength * 10);
    
    if (type === ColumnType.Number) return Math.max(100, baseWidth);
    if (type === ColumnType.Boolean) return 100;
    if (type === ColumnType.Date) return 130;
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

  openPayloadPopup(payload: any): void {
    this.currentPayload = payload;
    this.showPayloadPopup = true;
  }

  closePayloadPopup(): void {
    this.showPayloadPopup = false;
    this.currentPayload = null;
  }

  private detectRowKey(data: any[]): string | undefined {
    if (!data?.length) return undefined;
    const firstItem = data[0];
    const keyFields = ['id', 'orderId', 'eventId', 'itemCode'];
    for (const field of keyFields) {
      if (firstItem.hasOwnProperty(field)) {
        return field;
      }
    }
    return Object.keys(firstItem)[0];
  }

  private setupServerSideGrid(): void {
    const columns = this.getColumnsFromData(this.serverData);
    const rowKey = this.detectRowKey(this.serverData);
    
    // Ensure pageSize is 10 when setting up grid
    this.pageSize = 10;
    
    this.gridOptions = {
      columns,
      dataSource: this.dataStream.asObservable(),
      pageSizeOptions: [10, 20, 50, 100],
      defaultPageSize: 10,
      defaultFilters: [],
      editable: true,
      editMode: EditMode.Cell,
      selectionMode: SelectionMode.Multiple,
      rowKey,
      virtualScroll: false,
      columnReorder: true,
      columnResize: true,
      persistSettings: true,
      settingsKey: `server-side-grid-products`,
      showHeader: true,
      showFooter: true,
      showRowNumbers: true,
      enableExport: true,
      exportFormats: ['csv', 'excel', 'pdf'],
      keyboardNavigation: true,
      rowHeight: 32,
      headerHeight: 32,
      enableSearch: true,
      searchPlaceholder: 'Search all columns...'
    };
  }
}
