import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
  AfterViewInit
} from '@angular/core';
import { Subject, combineLatest, of } from 'rxjs';
import { debounceTime, switchMap, takeUntil, map, startWith } from 'rxjs/operators';
import {
  GridOptions,
  GridEvents,
  ColumnDef,
  DataSourceParams,
  PageResult,
  SortConfig,
  FilterCondition,
  GroupConfig,
  SelectionMode,
  EditMode,
  RowClickEvent,
  CellClickEvent,
  SelectionChangeEvent,
  SortChangeEvent,
  FilterChangeEvent,
  PageChangeEvent,
  EditEvent,
  DataStateChangeEvent,
  ColumnReorderEvent,
  ColumnResizeEvent,
  GroupToggleEvent,
  ExportRequestEvent,
  GridRow,
  GroupRow,
  isGroupRow,
  AggregateResult
} from '../types';
import { SortDirection, FilterOperator, ColumnType } from '../types/column.types';
import { DataService } from '../services/data.service';
import { GridStateService } from '../services/grid-state.service';
import { PersistenceService } from '../services/persistence.service';

/**
 * Main DataGrid Component
 */
@Component({
  selector: 'lib-data-grid',
  templateUrl: './data-grid.component.html',
  styleUrls: ['./data-grid.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DataService, GridStateService, PersistenceService]
})
export class DataGridComponent<T = any> implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() options!: GridOptions<T>;
  @Input() events?: GridEvents<T>;
  
  @Output() rowClick = new EventEmitter<RowClickEvent<T>>();
  @Output() cellClick = new EventEmitter<CellClickEvent<T>>();
  @Output() rowDoubleClick = new EventEmitter<RowClickEvent<T>>();
  @Output() cellDoubleClick = new EventEmitter<CellClickEvent<T>>();
  @Output() selectionChange = new EventEmitter<SelectionChangeEvent<T>>();
  @Output() sortChange = new EventEmitter<SortChangeEvent>();
  @Output() filterChange = new EventEmitter<FilterChangeEvent>();
  @Output() pageChange = new EventEmitter<PageChangeEvent>();
  @Output() editStart = new EventEmitter<EditEvent<T>>();
  @Output() editSave = new EventEmitter<EditEvent<T>>();
  @Output() editCancel = new EventEmitter<EditEvent<T>>();
  @Output() dataStateChange = new EventEmitter<DataStateChangeEvent>();
  @Output() columnReorder = new EventEmitter<ColumnReorderEvent>();
  @Output() columnResize = new EventEmitter<ColumnResizeEvent>();
  @Output() groupToggle = new EventEmitter<GroupToggleEvent<T>>();
  @Output() loadMore = new EventEmitter<{ groupKey: string; groupField: string; groupValue: any; parentKey: string }>();
  @Output() exportRequest = new EventEmitter<ExportRequestEvent>();

  @ViewChild('gridContainer', { static: false }) gridContainer!: ElementRef<HTMLElement>;
  @ViewChild('headerRow', { static: false }) headerRow!: ElementRef<HTMLElement>;
  @ViewChild('bodyContainer', { static: false }) bodyContainer!: ElementRef<HTMLElement>;

  // Data
  data: GridRow<T>[] = [];
  total = 0;
  loading = true;
  expandedGroups = new Set<string>();
  footerAggregates: AggregateResult[] = [];
  
  // Columns
  columns: ColumnDef<T>[] = [];
  visibleColumns: ColumnDef<T>[] = [];
  pinnedLeftColumns: ColumnDef<T>[] = [];
  pinnedRightColumns: ColumnDef<T>[] = [];
  normalColumns: ColumnDef<T>[] = [];
  
  // State
  currentPage = 1;
  pageSize = 20;
  selectedRows: T[] = [];
  selectedKeys: any[] = [];
  currentRow: T | null = null;
  editingRow: T | null = null;
  editingCell: { row: T; field: string } | null = null;
  expandedRows = new Set<any>();
  readonly skeletonTags = Array.from({ length: 3 }, (_, i) => i);
  
  /**
   * Get skeleton rows array based on current page size
   */
  get skeletonRows(): number[] {
    return Array.from({ length: this.pageSize || 10 }, (_, i) => i);
  }
  
  // Virtualization
  virtualScrollStart = 0;
  virtualScrollEnd = 0;
  rowHeight = 40;
  headerHeight = 60;
  
  // Infinite scroll
  accumulatedData: GridRow<T>[] = [];
  isLoadingMore = false;
  hasMoreData = true;
  currentLoadedPage = 0;
  
  // Search
  searchTerm = '';
  // Column filters
  columnFilters: { [field: string]: string } = {};
  
  // Drag & Drop
  draggedColumn: ColumnDef<T> | null = null;
  dragOverIndex = -1;
  draggedGroupIndex = -1;
  showGroupPanel = false;
  
  // Resizing
  resizingColumn: ColumnDef<T> | null = null;
  resizeStartX = 0;
  resizeStartWidth = 0;
  
  private destroy$ = new Subject<void>();
  private dataParams$ = new Subject<DataSourceParams>();
  isObservableDataSource = false; // Made public for template access
  private resizeListener?: () => void;

  constructor(
    private dataService: DataService<T>,
    private stateService: GridStateService<T>,
    private persistenceService: PersistenceService,
    private cdr: ChangeDetectorRef
  ) {}

  private isInitialized = false;
  
  ngOnInit(): void {
    if (!this.isInitialized) {
      this.initializeComponent();
      this.isInitialized = true;
    }
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    // Only re-initialize if options actually changed (not just reference)
    if (changes['options'] && !changes['options'].firstChange && this.isInitialized) {
      const prevOptions = changes['options'].previousValue;
      const currOptions = changes['options'].currentValue;
      
      // Check if dataSource actually changed
      if (prevOptions?.dataSource !== currOptions?.dataSource) {
        // Clean up old subscription
        this.destroy$.next();
        this.destroy$.complete();
        this.destroy$ = new Subject<void>();
        
        // Re-initialize with new options
        this.initializeComponent();
      } else {
        // Just update columns if they changed
        if (prevOptions?.columns !== currOptions?.columns) {
          this.initializeColumns();
        }
      }
    }
  }
  
  private initializeComponent(): void {
    this.initializeOptions();
    this.initializeColumns();
    this.loadPersistedSettings();
    
    // Auto-enable infinite scroll when grouping is enabled
    if (this.getCurrentGroups().length > 0 && !this.options.infiniteScroll) {
      this.options.infiniteScroll = true;
      this.options.infiniteScrollThreshold = this.options.infiniteScrollThreshold || 0.8;
    }
    
    this.setupDataSubscription();
    this.setupStateSubscriptions();
    // Show group panel by default if there are no groups
    if (this.getCurrentGroups().length === 0) {
      this.showGroupPanel = true;
    }
  }

  ngAfterViewInit(): void {
    // Setup virtual scroll if enabled or if grouping is active (which uses infinite scroll)
    if (this.options.virtualScroll || this.options.infiniteScroll || this.getCurrentGroups().length > 0) {
      this.setupVirtualScroll();
    }
    
    // Align header and body columns by accounting for scrollbar width
    this.alignHeaderWithBody();
    
    // Re-align when window resizes or data changes
    if (typeof window !== 'undefined') {
      this.resizeListener = () => this.alignHeaderWithBody();
      window.addEventListener('resize', this.resizeListener);
    }
  }
  
  /**
   * Align header columns with body columns by accounting for scrollbar width
   */
  private alignHeaderWithBody(): void {
    if (!this.headerRow?.nativeElement || !this.bodyContainer?.nativeElement) {
      return;
    }
    
    // Use requestAnimationFrame to ensure DOM is fully rendered
    requestAnimationFrame(() => {
      if (!this.headerRow?.nativeElement || !this.bodyContainer?.nativeElement) {
        return;
      }
      
      const body = this.bodyContainer.nativeElement;
      const headerRowEl = this.headerRow.nativeElement;
      
      // Get the actual content width of the body (excluding scrollbar)
      const bodyContentWidth = body.clientWidth;
      
      // Get the header row's parent (grid-header) width
      const headerParent = headerRowEl.parentElement;
      const headerParentWidth = headerParent?.clientWidth || 0;
      
      // Calculate scrollbar width
      const scrollbarWidth = body.offsetWidth - body.clientWidth;
      
      // Set header row width to match body's content width exactly
      // This ensures columns align perfectly
      if (scrollbarWidth > 0) {
        // When scrollbar is present, header should be narrower by scrollbar width
        headerRowEl.style.width = `${bodyContentWidth}px`;
        headerRowEl.style.maxWidth = `${bodyContentWidth}px`;
        headerRowEl.style.minWidth = `${bodyContentWidth}px`;
      } else {
        // When no scrollbar, both should be 100% of their container
        headerRowEl.style.width = `${headerParentWidth}px`;
        headerRowEl.style.maxWidth = `${headerParentWidth}px`;
        headerRowEl.style.minWidth = `${headerParentWidth}px`;
      }
      
      // Also ensure all cells in header and first row have matching widths
      this.syncColumnWidths();
      
      this.cdr.markForCheck();
    });
  }
  
  /**
   * Sync individual column widths between header and body cells
   * This ensures each column has the same width in both header and body
   */
  private syncColumnWidths(): void {
    if (!this.headerRow?.nativeElement || !this.bodyContainer?.nativeElement) {
      return;
    }
    
    const headerCells = Array.from(this.headerRow.nativeElement.querySelectorAll('.header-cell')) as HTMLElement[];
    const firstRow = this.bodyContainer.nativeElement.querySelector('.grid-row:not(.group-row):not(.load-more-row)') as HTMLElement;
    
    if (!firstRow || headerCells.length === 0) {
      return;
    }
    
    const bodyCells = Array.from(firstRow.querySelectorAll('.cell')) as HTMLElement[];
    
    // Sync widths for each column pair
    const minLength = Math.min(headerCells.length, bodyCells.length);
    for (let i = 0; i < minLength; i++) {
      const headerCell = headerCells[i];
      const bodyCell = bodyCells[i];
      
      if (headerCell && bodyCell) {
        // Get computed widths (including padding and borders)
        const headerRect = headerCell.getBoundingClientRect();
        const bodyRect = bodyCell.getBoundingClientRect();
        
        const headerWidth = headerRect.width;
        const bodyWidth = bodyRect.width;
        
        // Only sync if there's a significant difference (more than 2px to account for rounding)
        if (Math.abs(headerWidth - bodyWidth) > 2) {
          // Use the larger width to ensure content fits
          const targetWidth = Math.max(headerWidth, bodyWidth);
          
          // Get current flex values
          const headerFlex = window.getComputedStyle(headerCell).flex;
          const bodyFlex = window.getComputedStyle(bodyCell).flex;
          
          // Only set explicit width if the cell doesn't have a fixed width already
          // (pinned columns and columns with explicit width should keep their width)
          const headerHasFixedWidth = headerCell.style.width || headerCell.getAttribute('style')?.includes('width');
          const bodyHasFixedWidth = bodyCell.style.width || bodyCell.getAttribute('style')?.includes('width');
          
          if (!headerHasFixedWidth && !bodyHasFixedWidth) {
            // For flex columns, ensure both use the same flex basis
            // This maintains flex behavior while ensuring alignment
            const computedFlex = window.getComputedStyle(headerCell).flexBasis || 'auto';
            if (computedFlex !== 'auto') {
              bodyCell.style.flexBasis = computedFlex;
            }
          } else if (headerHasFixedWidth && !bodyHasFixedWidth) {
            // Header has fixed width, apply to body
            bodyCell.style.width = headerCell.style.width || `${headerWidth}px`;
            bodyCell.style.flex = '0 0 auto';
          } else if (!headerHasFixedWidth && bodyHasFixedWidth) {
            // Body has fixed width, apply to header
            headerCell.style.width = bodyCell.style.width || `${bodyWidth}px`;
            headerCell.style.flex = '0 0 auto';
          }
        }
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Remove resize listener
    if (this.resizeListener && typeof window !== 'undefined') {
      window.removeEventListener('resize', this.resizeListener);
    }
    
    this.savePersistedSettings();
    this.isInitialized = false;
  }

  /**
   * Initialize grid options with defaults
   */
  private initializeOptions(): void {
    // Set default for enableColumnFilters if not specified
    if (this.options.enableColumnFilters === undefined) {
      this.options.enableColumnFilters = true;
    }
    
    // Set default for enableSearch if not specified
    if (this.options.enableSearch === undefined) {
      this.options.enableSearch = true;
    }
    
    this.pageSize = this.options.defaultPageSize || 20;
    this.rowHeight = this.options.rowHeight || 40;
    // Increase header height if column filters are enabled
    // Header content: 60px min-height + 16px top padding + 8px bottom padding = 84px
    // Margin between header and filter: 12px
    // Filter row: 50px min-height + 10px top padding + 10px bottom padding = 70px
    // Total with filters: ~166px, without filters: ~84px
    const baseHeaderHeight = this.options.headerHeight || 84;
    this.headerHeight = (this.options.enableColumnFilters ? baseHeaderHeight + 82 : baseHeaderHeight);
    
    // Set initial page and page size in state service
    this.stateService.setPageSize(this.pageSize);
    this.stateService.setPage(1);
    
    if (this.options.defaultSort) {
      this.stateService.setSort(this.options.defaultSort);
    }
    if (this.options.defaultFilters) {
      this.stateService.setFilters(this.options.defaultFilters);
    }
    if (this.options.defaultGroups) {
      this.stateService.setGroups(this.options.defaultGroups);
    }
    
    // Only log in development
    const isProduction = typeof window !== 'undefined' && (window as any).ng?.coreTokens?.ENVIRONMENT?.production !== false;
    if (!isProduction) {
      const isObs = this.options.dataSource && typeof (this.options.dataSource as any).subscribe === 'function';
      console.log('[DataGridComponent] Setting data source', {
        type: Array.isArray(this.options.dataSource) ? 'CLIENT-SIDE (array)' : typeof this.options.dataSource === 'function' ? 'SERVER-SIDE (function)' : isObs ? 'SERVER-SIDE (observable)' : 'unknown',
        hasDataSource: !!this.options.dataSource
      });
    }
    // Track if data source is an Observable to prevent infinite loops
    this.isObservableDataSource = !Array.isArray(this.options.dataSource) && 
                                   typeof this.options.dataSource !== 'function' && 
                                   this.options.dataSource && 
                                   typeof (this.options.dataSource as any).subscribe === 'function';
    this.dataService.setDataSource(this.options.dataSource);
  }

  /**
   * Initialize columns
   */
  private initializeColumns(): void {
    this.columns = [...this.options.columns];
    
    // Set default filterable to true for all columns (unless explicitly set to false)
    this.columns.forEach(col => {
      if (col.filterable === undefined) {
        col.filterable = true;
      }
    });
    
    // Apply column order if persisted
    const columnOrder = this.stateService.getColumnOrder();
    if (columnOrder.length > 0) {
      this.columns.sort((a, b) => {
        const indexA = columnOrder.indexOf(a.field);
        const indexB = columnOrder.indexOf(b.field);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    }
    
    // Apply column widths if persisted
    const columnWidths = this.stateService.getColumnWidths();
    this.columns.forEach(col => {
      if (columnWidths[col.field]) {
        col.width = columnWidths[col.field];
      }
    });
    
    this.updateColumnGroups();
  }

  /**
   * Update column groups (pinned left, normal, pinned right)
   */
  private updateColumnGroups(): void {
    const visible = this.stateService.getVisibleColumns();
    this.visibleColumns = this.columns.filter(col => {
      if (col.visible === false) return false;
      if (visible.size > 0 && !visible.has(col.field)) return false;
      return true;
    });
    
    this.pinnedLeftColumns = this.visibleColumns.filter(col => col.pinned === 'left');
    this.pinnedRightColumns = this.visibleColumns.filter(col => col.pinned === 'right');
    this.normalColumns = this.visibleColumns.filter(col => !col.pinned);
  }

  /**
   * Setup data subscription
   */
  private setupDataSubscription(): void {
    combineLatest([
      this.stateService.page$.pipe(startWith(this.stateService.getPage())),
      this.stateService.pageSize$.pipe(startWith(this.stateService.getPageSize())),
      this.stateService.sort$.pipe(startWith(this.stateService.getSort())),
      this.stateService.filters$.pipe(startWith(this.stateService.getFilters())),
      this.stateService.groups$.pipe(startWith(this.stateService.getGroups()))
    ]).pipe(
      debounceTime(100),
      switchMap(([page, pageSize, sort, filters, groups]) => {
        // Reset accumulated data when filters, sort, or groups change (not infinite scroll)
        if (!this.isLoadingMore) {
          this.accumulatedData = [];
          this.currentLoadedPage = 0;
          this.hasMoreData = true;
        }
        
        // Disable infinite scroll: always use explicit page controls
        const isInfiniteScroll = false;
        const currentPage = page;
        const skip = (currentPage - 1) * pageSize;
        
        const params: DataSourceParams = {
          page: currentPage,
          pageSize,
          skip,
          take: pageSize,
          sort: sort.filter(s => s.direction !== SortDirection.None),
          filters,
          groups,
          infiniteScroll: false
        };
        
        // Only log in development mode (reduced frequency)
        const isProduction = typeof window !== 'undefined' && (window as any).ng?.coreTokens?.ENVIRONMENT?.production !== false;
        if (!isProduction && !this.isLoadingMore) {
          console.log('[DataGridComponent] Requesting data', {
            page: currentPage,
            pageSize,
            sortCount: params.sort?.length || 0,
            filterCount: params.filters?.length || 0,
            groupCount: params.groups?.length || 0
          });
        }
        
        // Only show loading indicator on initial load or when not using infinite scroll
        if (!isInfiniteScroll) {
          this.loading = true;
        }
        this.cdr.markForCheck();
        
        return this.dataService.getData(params, this.columns).pipe(
          map(result => ({ result, params, isInfiniteScroll }))
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: ({ result, params, isInfiniteScroll }) => {
        // Align header with body after data loads
        setTimeout(() => {
          this.alignHeaderWithBody();
          // Also align after a short delay to ensure rendering is complete
          setTimeout(() => this.alignHeaderWithBody(), 50);
        }, 0);
        // Always replace data (no infinite scroll)
        this.accumulatedData = result.data;
        this.currentLoadedPage = params.page || 1;
        this.hasMoreData = result.data.length < result.total;
        this.loading = false;
        this.isLoadingMore = false;
        
        this.data = this.accumulatedData;
        this.total = result.total;
        this.currentPage = params.page || 1;
        this.pageSize = params.pageSize || 20;
        
        // Initialize expanded groups (before calculating aggregates)
        this.initializeExpandedGroups();
        
        // Calculate footer aggregates
        this.calculateFooterAggregates();
        
        if (this.options.virtualScroll) {
          this.updateVirtualScroll();
        }
        
        // Don't emit dataStateChange for Observable data sources to prevent infinite loops
        // The component managing the Observable is already handling state through individual event handlers
        if (!this.isObservableDataSource) {
          this.emitDataStateChange(params);
        }
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('[DataGridComponent] Error loading data', error);
        this.loading = false;
        this.isLoadingMore = false;
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Setup state subscriptions
   */
  private setupStateSubscriptions(): void {
    this.stateService.selectedRows$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(rows => {
      this.selectedRows = rows;
      this.selectedKeys = rows.map(row => this.getRowKey(row));
      this.emitSelectionChange();
      this.cdr.markForCheck();
    });
    
    this.stateService.currentRow$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(row => {
      this.currentRow = row;
      this.cdr.markForCheck();
    });
    
    this.stateService.editingRow$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(row => {
      this.editingRow = row;
      this.cdr.markForCheck();
    });
    
    this.stateService.editingCell$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(cell => {
      this.editingCell = cell;
      this.cdr.markForCheck();
    });
  }

  /**
   * Setup virtual scroll
   */
  private setupVirtualScroll(): void {
    if (!this.bodyContainer) return;
    
    const container = this.bodyContainer.nativeElement;
    const buffer = this.options.virtualScrollBuffer || 5;
    
    container.addEventListener('scroll', () => {
      this.updateVirtualScroll();
    });
    
    this.updateVirtualScroll();
  }
  
  /**
   * (Disabled) Check if we need to load more data for infinite scroll
   */
  private checkInfiniteScroll(container: HTMLElement): void {
    // Infinite scroll is disabled; pagination is controlled solely by footer controls.
    return;
  }
  
  /**
   * (Disabled) Load more data for infinite scroll
   */
  private loadMoreData(): void {
    // Infinite scroll is disabled; pagination is controlled solely by footer controls.
    return;
  }

  /**
   * Update virtual scroll range
   */
  private updateVirtualScroll(): void {
    if (!this.bodyContainer || !this.options.virtualScroll) return;
    
    const container = this.bodyContainer.nativeElement;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const buffer = this.options.virtualScrollBuffer || 5;
    
    const start = Math.max(0, Math.floor(scrollTop / this.rowHeight) - buffer);
    const end = Math.min(
      this.data.length,
      Math.ceil((scrollTop + containerHeight) / this.rowHeight) + buffer
    );
    
    this.virtualScrollStart = start;
    this.virtualScrollEnd = end;
    this.cdr.markForCheck();
  }

  /**
   * Get visible rows for virtualization (with group filtering)
   */
  getVisibleRows(): GridRow<T>[] {
    let visibleRows = this.filterExpandedGroups(this.data);
    
    if (!this.options.virtualScroll) {
      return visibleRows;
    }
    return visibleRows.slice(this.virtualScrollStart, this.virtualScrollEnd);
  }

  /**
   * Filter rows based on expanded groups
   */
  private filterExpandedGroups(rows: GridRow<T>[]): GridRow<T>[] {
    const result: GridRow<T>[] = [];
    let i = 0;
    
    while (i < rows.length) {
      const row = rows[i];
      
      if (isGroupRow(row)) {
        // Always include group row
        result.push(row);
        
        // Check if group is expanded
        const isExpanded = row.expanded && this.expandedGroups.has(row.key);
        
        if (isExpanded) {
          // Group is expanded - include its children
          i++; // Move to next row
          
          // Collect all children (until we hit a group at same or higher level)
          const children: GridRow<T>[] = [];
          while (i < rows.length) {
            const childRow = rows[i];
            
            if (isGroupRow(childRow)) {
              // If it's a group at same or higher level, stop
              if (childRow.level <= row.level) {
                break;
              }
              // Nested group - add it
              children.push(childRow);
            } else {
              // Data row - check if it belongs to this group
              const rowValue = this.getFieldValue(childRow as T, row.field);
              if (String(rowValue) === String(row.value)) {
                children.push(childRow);
              } else {
                // Doesn't belong to this group, stop
                break;
              }
            }
            i++;
          }
          
          // Recursively filter children
          if (children.length > 0) {
            const filteredChildren = this.filterExpandedGroups(children);
            result.push(...filteredChildren);
          }
          
          // Don't increment i here, we already did it in the loop
          continue;
        } else {
          // Group is collapsed - skip all its children
          i++; // Move past the group row
          
          // Skip children until we hit a group at same or higher level
          while (i < rows.length) {
            const nextRow = rows[i];
            
            if (isGroupRow(nextRow)) {
              // If it's a group at same or higher level, stop skipping
              if (nextRow.level <= row.level) {
                break;
              }
              // Nested group - skip it and its children
              i++;
            } else {
              // Data row - check if it belongs to this group
              const rowValue = this.getFieldValue(nextRow as T, row.field);
              if (String(rowValue) === String(row.value)) {
                // Belongs to collapsed group - skip it
                i++;
              } else {
                // Doesn't belong - stop skipping
                break;
              }
            }
          }
          
          continue;
        }
      } else {
        // Data row without a parent group (shouldn't happen with grouping)
        result.push(row);
        i++;
      }
    }
    
    return result;
  }

  /**
   * Initialize expanded groups
   */
  private initializeExpandedGroups(): void {
    // Clear existing expanded groups
    this.expandedGroups.clear();
    
    // Add all groups to expanded set only if they are explicitly marked as expanded
    this.data.forEach(row => {
      if (isGroupRow(row)) {
        // Only expand groups that are explicitly set to expanded: true
        // Groups with expanded: false or undefined should remain collapsed
        if (row.expanded === true) {
          this.expandedGroups.add(row.key);
        } else {
          // Ensure collapsed groups are explicitly set to false
          row.expanded = false;
        }
      }
    });
  }

  /**
   * Calculate footer aggregates
   */
  private calculateFooterAggregates(): void {
    const dataRows = this.data.filter(row => !isGroupRow(row)) as T[];
    this.footerAggregates = [];
    
    for (const column of this.columns) {
      if (column.aggregate && column.aggregate !== 'custom') {
        const value = this.dataService.calculateAggregates(dataRows, column.field, column.aggregate);
        this.footerAggregates.push({
          field: column.field,
          aggregate: column.aggregate,
          value
        });
      } else if (column.aggregate === 'custom' && column.aggregateFn) {
        const values = dataRows.map(row => this.getFieldValue(row, column.field)).filter(v => v != null);
        const value = column.aggregateFn(values);
        this.footerAggregates.push({
          field: column.field,
          aggregate: 'custom',
          value
        });
      }
    }
  }

  /**
   * Toggle group expansion
   */
  toggleGroup(groupRow: GroupRow<T>): void {
    const wasExpanded = this.expandedGroups.has(groupRow.key);
    if (wasExpanded) {
      this.expandedGroups.delete(groupRow.key);
      groupRow.expanded = false;
    } else {
      this.expandedGroups.add(groupRow.key);
      groupRow.expanded = true;
    }
    
    // Emit group toggle event
    const event: GroupToggleEvent<T> = {
      groupRow,
      expanded: !wasExpanded
    };
    this.groupToggle.emit(event);
    if (this.events?.groupToggle) {
      this.events.groupToggle(event);
    }
    
    this.cdr.markForCheck();
  }

  /**
   * Check if group is expanded
   */
  isGroupExpanded(groupRow: GroupRow<T>): boolean {
    return this.expandedGroups.has(groupRow.key);
  }

  /**
   * Get aggregate value for a column
   */
  getAggregateValue(column: ColumnDef<T>, groupRow?: GroupRow<T>): any {
    if (groupRow && groupRow.aggregates) {
      const aggregate = groupRow.aggregates.find(a => a.field === column.field);
      if (aggregate) {
        return aggregate.value;
      }
    }
    
    // Footer aggregate
    const footerAggregate = this.footerAggregates.find(a => a.field === column.field);
    return footerAggregate?.value;
  }

  /**
   * Format aggregate value
   */
  formatAggregateValue(value: any, aggregate: string, column?: ColumnDef<T>): string {
    if (value == null) return '';
    
    switch (aggregate) {
      case 'sum':
      case 'avg':
      case 'min':
      case 'max':
        if (column?.type === 'number') {
          const numValue = typeof value === 'number' ? value : parseFloat(String(value));
          if (isNaN(numValue)) return String(value);
          // For avg, show 1 decimal place, for others show 2
          const decimals = aggregate === 'avg' ? 1 : 2;
          return numValue.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        }
        return String(value);
      case 'count':
        return String(value);
      default:
        return String(value);
    }
  }

  /**
   * Format aggregate label for footer
   */
  formatAggregateLabel(field: string, aggregate: string): string {
    const columnTitle = this.getColumnTitle(field);
    const aggregateLabel = aggregate.charAt(0).toUpperCase() + aggregate.slice(1);
    
    switch (aggregate) {
      case 'sum':
        return `Total ${columnTitle}`;
      case 'avg':
        return `Average ${columnTitle}`;
      case 'min':
        return `Min ${columnTitle}`;
      case 'max':
        return `Max ${columnTitle}`;
      case 'count':
        return `Count ${columnTitle}`;
      default:
        return `${aggregateLabel} ${columnTitle}`;
    }
  }

  /**
   * Check if row is a group row (for template use)
   */
  isGroupRowType(row: GridRow<T>): row is GroupRow<T> {
    return isGroupRow(row);
  }

  /**
   * Check if a row is a "Load More" row
   */
  isLoadMoreRow(row: any): boolean {
    return row && row.__type === '__LOAD_MORE_ROW__';
  }

  /**
   * Get count of visible data rows (excluding group rows)
   */
  getVisibleDataRowsCount(): number {
    return this.getVisibleRows().filter(r => !isGroupRow(r)).length;
  }

  /**
   * Get count of visible group rows
   */
  getVisibleGroupRowsCount(): number {
    return this.getVisibleRows().filter(r => isGroupRow(r)).length;
  }

  /**
   * Get row key
   */
  getRowKey(row: GridRow<T>): any {
    if (isGroupRow(row)) {
      return row.key;
    }
    
    if (typeof this.options.rowKey === 'function') {
      return this.options.rowKey(row as T);
    }
    if (typeof this.options.rowKey === 'string') {
      return (row as any)[this.options.rowKey];
    }
    return row;
  }

  /**
   * Track by function for rows
   */
  trackByRow = (index: number, row: GridRow<T>): any => {
    return this.getRowKey(row);
  }

  /**
   * Track by function for columns
   */
  trackByColumn = (index: number, column: ColumnDef<T>): string => {
    return column.field;
  }

  getColumnFlex(column: ColumnDef<T>): string {
    const basis = column.width || column.minWidth || 120;
    return `1 1 ${basis}px`;
  }

  getSkeletonType(column: ColumnDef<T>): 'text' | 'long-text' | 'number' | 'status' | 'tags' | 'rating' | 'image' | 'boolean' | 'date' {
    const field = (column.field || '').toLowerCase();
    const css = (column.cssClass || '').toLowerCase();
    const type = column.type;

    const isImage = /image|img|thumbnail|avatar|photo|logo|picture/.test(field) || /image|avatar|thumbnail/.test(css);
    if (isImage) return 'image';

    const isRating = /rating|stars|score|review/.test(field) || /rating|stars/.test(css);
    if (isRating) return 'rating';

    const isStatus = /status|state|stage/.test(field) || /status|pill|badge/.test(css);
    if (isStatus) return 'status';

    const isTags = /tags|tag|labels|categories|category|chips/.test(field) || /tags|chips/.test(css);
    if (isTags) return 'tags';

    const isBoolean = type === ColumnType.Boolean || /active|enabled|available|is_|has_|flag|verified|visible/.test(field);
    if (isBoolean) return 'boolean';

    if (type === ColumnType.Number) return 'number';
    if (type === ColumnType.Date) return 'date';

    const isLongText = /description|details|summary|comment|notes|address|message|content/.test(field);
    const width = column.width || column.maxWidth || column.minWidth || 0;
    if (isLongText || width >= 240) return 'long-text';

    return 'text';
  }

  getSkeletonCellClasses(column: ColumnDef<T>): Record<string, boolean> {
    const type = this.getSkeletonType(column);
    const alignRight = column.align === 'right' || type === 'number';
    const alignCenter = column.align === 'center' || type === 'boolean';
    return {
      'is-number': type === 'number',
      'is-long-text': type === 'long-text',
      'is-status': type === 'status',
      'is-tags': type === 'tags',
      'is-rating': type === 'rating',
      'is-image': type === 'image',
      'is-boolean': type === 'boolean',
      'align-right': alignRight,
      'align-center': alignCenter
    };
  }

  /**
   * Pagination range helpers
   */
  getRangeStart(): number {
    if (this.total === 0) return 0;
    const start = (this.currentPage - 1) * this.pageSize + 1;
    return Math.min(start, this.total);
  }

  getRangeEnd(): number {
    if (this.total === 0) return 0;
    const end = (this.currentPage - 1) * this.pageSize + this.getVisibleRows().length;
    return Math.min(end, this.total);
  }

  /**
   * Track by function for groups
   */
  trackByGroup = (index: number, group: GroupConfig): string => {
    return `${group.field}-${index}`;
  }

  /**
   * Handle column header click (sorting)
   */
  onColumnHeaderClick(column: ColumnDef<T>, event: MouseEvent): void {
    if (!column.sortable) return;
    
    // Toggle sort for this column
    this.stateService.toggleSort(column.field);
    const sort = this.stateService.getSort();
    
    // Emit sort change event
    this.emitSortChange({ sort });
    
    if (this.events?.sortChange) {
      this.events.sortChange({ sort });
    }
    
    this.cdr.markForCheck();
  }
  
  /**
   * Handle search input change
   */
  onSearchChange(searchTerm: string): void {
    this.searchTerm = searchTerm;
    
    // Get searchable columns
    const searchableColumns = this.options.searchableColumns 
      ? this.columns.filter(c => this.options.searchableColumns!.includes(c.field))
      : this.columns.filter(c => c.filterable !== false);
    
    // Remove existing search filters
    const currentFilters = this.stateService.getFilters();
    const nonSearchFilters = currentFilters.filter(f => 
      !searchableColumns.some(col => col.field === f.field && f.operator === FilterOperator.Contains)
    );
    
    // Add new search filters if search term exists
    let newFilters = [...nonSearchFilters];
    
    if (searchTerm && searchTerm.trim()) {
      const searchFilters: FilterCondition[] = searchableColumns.map(column => ({
        field: column.field,
        operator: FilterOperator.Contains,
        value: searchTerm.trim()
      }));
      
      newFilters = [...nonSearchFilters, ...searchFilters];
    }
    
    // Update filters
    this.stateService.setFilters(newFilters);
    
    // Emit filter change event
    const filterEvent: FilterChangeEvent = { filters: newFilters };
    this.filterChange.emit(filterEvent);
    
    if (this.events?.filterChange) {
      this.events.filterChange(filterEvent);
    }
    
    this.cdr.markForCheck();
  }
  
  /**
   * Clear search
   */
  clearSearch(): void {
    this.searchTerm = '';
    this.onSearchChange('');
  }
  
  /**
   * Clear all column filters
   */
  clearAllFilters(): void {
    // Clear all column filter inputs
    this.columnFilters = {};
    
    // Get current filters and remove only column-specific filters (keep global search)
    const currentFilters = this.stateService.getFilters();
    const searchableColumns = this.options.searchableColumns 
      ? this.columns.filter(c => this.options.searchableColumns!.includes(c.field))
      : this.columns.filter(c => c.filterable !== false);
    
    // Keep only global search filters
    const globalSearchFilters = currentFilters.filter(f => {
      const isGlobalSearch = searchableColumns.some(col => 
        col.field === f.field && f.operator === FilterOperator.Contains
      );
      return isGlobalSearch;
    });
    
    // Update filters
    this.stateService.setFilters(globalSearchFilters);
    
    // Emit filter change event
    const filterEvent: FilterChangeEvent = { filters: globalSearchFilters };
    this.filterChange.emit(filterEvent);
    
    if (this.events?.filterChange) {
      this.events.filterChange(filterEvent);
    }
    
    // Force change detection
    this.cdr.detectChanges();
  }
  
  /**
   * Handle column filter change
   */
  onColumnFilterChange(field: string, value: string): void {
    console.log('[FILTER DEBUG] onColumnFilterChange called:', {
      field,
      rawValue: value,
      valueType: typeof value,
      valueLength: value?.length,
      timestamp: new Date().toISOString()
    });
    
    // Handle null, undefined, or empty string - use raw value for display, trim for filtering
    const rawValue = value ?? '';
    const trimmedValue = rawValue.trim();
    // Check if empty: null, undefined, empty string, or only whitespace
    const isEmpty = !rawValue || trimmedValue.length === 0;
    
    console.log('[FILTER DEBUG] Value processing:', {
      rawValue,
      trimmedValue,
      isEmpty,
      beforeColumnFilters: { ...this.columnFilters }
    });
    
    // Create a new object reference to trigger change detection (OnPush strategy)
    const updatedFilters = { ...this.columnFilters };
    
    // Update the columnFilters object - store raw value for display, but filter will use trimmed
    if (isEmpty) {
      console.log('[FILTER DEBUG] Filter is empty - removing filter for field:', field);
      // Remove the filter entry if empty
      delete updatedFilters[field];
    } else {
      console.log('[FILTER DEBUG] Filter has value - setting filter:', { field, rawValue, trimmedValue });
      // Store the raw value (not trimmed) so input shows what user typed
      updatedFilters[field] = rawValue;
    }
    
    // Update the reference to trigger change detection
    this.columnFilters = updatedFilters;
    
    console.log('[FILTER DEBUG] Updated columnFilters:', { ...this.columnFilters });
    
    // Get current filters
    const currentFilters = this.stateService.getFilters();
    
    console.log('[FILTER DEBUG] Current filters from state service:', currentFilters);
    
    // Remove existing filter for this column (if any) - but keep global search filters
    const searchableColumns = this.options.searchableColumns 
      ? this.columns.filter(c => this.options.searchableColumns!.includes(c.field))
      : this.columns.filter(c => c.filterable !== false);
    
    // Check if there's a global search active (searchTerm exists)
    const hasGlobalSearch = this.searchTerm && this.searchTerm.trim().length > 0;
    const globalSearchValue = hasGlobalSearch ? this.searchTerm.trim() : null;
    
    // Remove column-specific filters (but keep global search filters)
    const otherFilters = currentFilters.filter(f => {
      // If this filter is for a different field, keep it
      if (f.field !== field) {
        return true;
      }
      
      // If this filter matches the global search value, it's a global search filter - keep it
      if (hasGlobalSearch && globalSearchValue && f.value === globalSearchValue && f.operator === FilterOperator.Contains) {
        console.log('[FILTER DEBUG] Keeping global search filter:', f);
        return true;
      }
      
      // Otherwise, this is a column-specific filter for this field - remove it
      console.log('[FILTER DEBUG] Removing column-specific filter:', f);
      return false;
    });
    
    console.log('[FILTER DEBUG] Filters after removing column-specific:', otherFilters);
    
    // Add new filter if value exists and is not empty (use trimmed value for filtering)
    let newFilters = [...otherFilters];
    
    if (!isEmpty && trimmedValue.length > 0) {
      const filter: FilterCondition = {
        field,
        operator: FilterOperator.Contains,
        value: trimmedValue
      };
      newFilters.push(filter);
      console.log('[FILTER DEBUG] Added new filter:', filter);
    } else {
      console.log('[FILTER DEBUG] Filter is empty - not adding filter condition');
    }
    
    console.log('[FILTER DEBUG] Final filters array before update:', newFilters);
    console.log('[FILTER DEBUG] Filter count:', newFilters.length);
    console.log('[FILTER DEBUG] Will clear filter:', isEmpty);
    
    // Update filters - this will trigger data refresh via filters$ observable
    this.stateService.setFilters(newFilters);
    
    // Verify filters were set correctly
    const verifyFilters = this.stateService.getFilters();
    console.log('[FILTER DEBUG] Filters verified in state service:', verifyFilters);
    console.log('[FILTER DEBUG] Verified filter count:', verifyFilters.length);
    
    // Emit filter change event
    const filterEvent: FilterChangeEvent = { filters: newFilters };
    this.filterChange.emit(filterEvent);
    
    if (this.events?.filterChange) {
      this.events.filterChange(filterEvent);
    }
    
    console.log('[FILTER DEBUG] Filter change event emitted, filters count:', newFilters.length);
    
    // Force change detection to update the UI and input values
    this.cdr.detectChanges();
    
    console.log('[FILTER DEBUG] Change detection triggered');
    console.log('[FILTER DEBUG] Data should refresh now via filters$ subscription');
  }

  /**
   * Handle load more click
   */
  onLoadMoreClick(row: any, event: MouseEvent): void {
    event.stopPropagation();
    if (row && row.__type === '__LOAD_MORE_ROW__') {
      this.loadMore.emit({
        groupKey: row.groupKey,
        groupField: row.groupField,
        groupValue: row.groupValue,
        parentKey: row.parentKey
      });
    }
  }

  /**
   * Handle row click
   */
  onRowClick(row: GridRow<T>, index: number, event: MouseEvent): void {
    // Handle load more row click
    if (this.isLoadMoreRow(row)) {
      this.onLoadMoreClick(row, event);
      return;
    }
    
    // Handle group row click (toggle expansion)
    if (isGroupRow(row)) {
      this.toggleGroup(row);
      return;
    }
    
    const rowKey = this.getRowKey(row);
    this.stateService.setCurrentRow(row as T);
    
    // Handle selection for single select mode
    if (this.options.selectionMode === SelectionMode.Single) {
      this.stateService.setSelectedRows([row as T]);
      this.stateService.setSelectedKeys([rowKey]);
      this.selectionChange.emit({
        selectedRows: [row as T],
        selectedKeys: [rowKey],
        currentRow: row as T
      });
    }
    
    const clickEvent: RowClickEvent<T> = { row: row as T, rowIndex: index, event };
    this.rowClick.emit(clickEvent);
    
    if (this.events?.rowClick) {
      this.events.rowClick(clickEvent);
    }
  }

  /**
   * Handle cell click
   */
  onCellClick(row: GridRow<T>, column: ColumnDef<T>, rowIndex: number, columnIndex: number, event: MouseEvent): void {
    if (isGroupRow(row)) {
      // Group row click handled in onRowClick
      return;
    }
    
    const value = this.getFieldValue(row as T, column.field);
    const clickEvent: CellClickEvent<T> = {
      row: row as T,
      rowIndex,
      column,
      columnIndex,
      value,
      event
    };
    this.cellClick.emit(clickEvent);
    
    if (this.events?.cellClick) {
      this.events.cellClick(clickEvent);
    }
  }

  /**
   * Handle row double click
   */
  onRowDoubleClick(row: GridRow<T>, index: number, event: MouseEvent): void {
    if (isGroupRow(row)) {
      return; // Group rows don't trigger double click
    }
    
    const clickEvent: RowClickEvent<T> = { row: row as T, rowIndex: index, event };
    this.rowDoubleClick.emit(clickEvent);
    
    if (this.events?.rowDoubleClick) {
      this.events.rowDoubleClick(clickEvent);
    }
  }

  /**
   * Handle cell double click (start editing)
   */
  onCellDoubleClick(row: GridRow<T>, column: ColumnDef<T>, rowIndex: number, columnIndex: number, event: MouseEvent): void {
    if (isGroupRow(row) || !column.editable || !this.options.editable) return;
    
    this.startCellEdit(row as T, column);
    
    const clickEvent: CellClickEvent<T> = {
      row: row as T,
      rowIndex,
      column,
      columnIndex,
      value: this.getFieldValue(row as T, column.field),
      event
    };
    this.cellDoubleClick.emit(clickEvent);
    
    if (this.events?.cellDoubleClick) {
      this.events.cellDoubleClick(clickEvent);
    }
  }

  /**
   * Handle selection
   */
  onRowSelect(row: GridRow<T>, event: Event): void {
    if (isGroupRow(row) || this.options.selectionMode === SelectionMode.None) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const rowKey = this.getRowKey(row);
    const selectedRows = [...this.stateService.getSelectedRows()];
    const selectedKeys = [...this.stateService.getSelectedKeys()];
    const mouseEvent = event as MouseEvent;
    
    // Get only data rows for selection
    const dataRows = this.data.filter(r => !isGroupRow(r)) as T[];
    
    if (this.options.selectionMode === SelectionMode.Multiple) {
      // Multiple selection mode - toggle row selection
      const index = selectedKeys.indexOf(rowKey);
      if (index >= 0) {
        // Row is already selected - remove it
        selectedRows.splice(index, 1);
        selectedKeys.splice(index, 1);
      } else {
        // Row is not selected - add it
        selectedRows.push(row as T);
        selectedKeys.push(rowKey);
      }
      this.stateService.setSelectedRows(selectedRows);
      this.stateService.setSelectedKeys(selectedKeys);
    } else if (mouseEvent.shiftKey && this.options.selectionMode === SelectionMode.Range) {
      // Range selection
      const currentIndex = dataRows.findIndex(r => this.getRowKey(r) === rowKey);
      const lastSelectedIndex = dataRows.findIndex(r => 
        this.stateService.getSelectedKeys().includes(this.getRowKey(r))
      );
      
      if (lastSelectedIndex >= 0) {
        const start = Math.min(currentIndex, lastSelectedIndex);
        const end = Math.max(currentIndex, lastSelectedIndex);
        const rangeRows = dataRows.slice(start, end + 1);
        const rangeKeys = rangeRows.map(r => this.getRowKey(r));
        
        this.stateService.setSelectedRows(rangeRows);
        this.stateService.setSelectedKeys(rangeKeys);
      }
    } else if (this.options.selectionMode === SelectionMode.Single) {
      // Single select
      this.stateService.setSelectedRows([row as T]);
      this.stateService.setSelectedKeys([rowKey]);
    }
    
    // Emit selection change event
    this.selectionChange.emit({
      selectedRows: this.stateService.getSelectedRows(),
      selectedKeys: this.stateService.getSelectedKeys(),
      currentRow: this.stateService.getCurrentRow() || undefined
    });
    
    // Trigger change detection to update checkbox states
    this.cdr.detectChanges();
  }

  /**
   * Handle select all
   */
  onSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const dataRows = this.data.filter(r => !isGroupRow(r)) as T[];
    
    if (checked) {
      this.stateService.setSelectedRows([...dataRows]);
      this.stateService.setSelectedKeys(dataRows.map(row => this.getRowKey(row)));
    } else {
      this.stateService.setSelectedRows([]);
      this.stateService.setSelectedKeys([]);
    }
  }

  /**
   * Check if row is selected
   */
  isRowSelected(row: GridRow<T>): boolean {
    if (isGroupRow(row)) return false;
    const rowKey = this.getRowKey(row);
    return this.stateService.getSelectedKeys().includes(rowKey);
  }

  /**
   * Check if all rows are selected
   */
  isAllSelected(): boolean {
    const dataRows = this.data.filter(r => !isGroupRow(r));
    return dataRows.length > 0 && 
           this.stateService.getSelectedRows().length === dataRows.length;
  }

  /**
   * Check if some rows are selected (indeterminate)
   */
  isIndeterminate(): boolean {
    const dataRows = this.data.filter(r => !isGroupRow(r));
    const selectedCount = this.stateService.getSelectedRows().length;
    return selectedCount > 0 && selectedCount < dataRows.length;
  }

  /**
   * Start cell editing
   */
  startCellEdit(row: T, column: ColumnDef<T>): void {
    if (!column.editable || !this.options.editable) return;
    
    this.stateService.setEditingCell({ row, field: column.field });
    
    const editEvent: EditEvent<T> = {
      row,
      rowIndex: this.data.indexOf(row),
      column,
      columnIndex: this.visibleColumns.indexOf(column),
      oldValue: this.getFieldValue(row, column.field),
      newValue: this.getFieldValue(row, column.field)
    };
    
    this.editStart.emit(editEvent);
    if (this.events?.editStart) {
      this.events.editStart(editEvent);
    }
  }

  /**
   * Save cell edit
   */
  saveCellEdit(row: T, column: ColumnDef<T>, value: any): void {
    const oldValue = this.getFieldValue(row, column.field);
    const parsedValue = column.valueParser 
      ? column.valueParser(String(value), row, column)
      : value;
    
    (row as any)[column.field] = parsedValue;
    
    this.stateService.setEditingCell(null);
    
    const editEvent: EditEvent<T> = {
      row,
      rowIndex: this.data.indexOf(row),
      column,
      columnIndex: this.visibleColumns.indexOf(column),
      oldValue,
      newValue: parsedValue
    };
    
    this.editSave.emit(editEvent);
    if (this.events?.editSave) {
      this.events.editSave(editEvent);
    }
    
    this.cdr.markForCheck();
  }

  /**
   * Cancel cell edit
   */
  cancelCellEdit(): void {
    const editingCell = this.stateService.getEditingCell();
    if (!editingCell) return;
    
    const editEvent: EditEvent<T> = {
      row: editingCell.row,
      rowIndex: this.data.indexOf(editingCell.row),
      column: this.visibleColumns.find(c => c.field === editingCell.field)!,
      columnIndex: this.visibleColumns.findIndex(c => c.field === editingCell.field)
    };
    
    this.stateService.setEditingCell(null);
    
    this.editCancel.emit(editEvent);
    if (this.events?.editCancel) {
      this.events.editCancel(editEvent);
    }
    
    this.cdr.markForCheck();
  }

  /**
   * Handle page change
   */
  onPageChange(page: number): void {
    // Don't allow manual page changes when grouping is enabled with client-side data (use infinite scroll instead)
    // But allow it for server-side data source (Observable) which supports pagination with grouping
    if (this.getCurrentGroups().length > 0 && !this.isObservableDataSource) {
      return;
    }
    
    // Reset accumulated data when changing pages manually (not infinite scroll)
    if (!this.options.infiniteScroll) {
      this.accumulatedData = [];
      this.currentLoadedPage = 0;
    }
    
    this.stateService.setPage(page);
    const currentPageSize = this.stateService.getPageSize() || this.pageSize;
    this.pageSize = currentPageSize;
    const pageEvent: PageChangeEvent = {
      page,
      pageSize: currentPageSize,
      skip: (page - 1) * currentPageSize,
      take: currentPageSize
    };
    this.pageChange.emit(pageEvent);
    if (this.events?.pageChange) {
      this.events.pageChange(pageEvent);
    }
  }

  /**
   * Handle page size change
   */
  onPageSizeChange(pageSize: number): void {
    // Don't allow page size changes when grouping is enabled with client-side data (use infinite scroll instead)
    // But allow it for server-side data source (Observable) which supports pagination with grouping
    if (this.getCurrentGroups().length > 0 && !this.isObservableDataSource) {
      return;
    }
    
    this.pageSize = pageSize;
    this.stateService.setPageSize(pageSize);
    this.onPageChange(1);
  }

  /**
   * Handle column resize start
   */
  onColumnResizeStart(column: ColumnDef<T>, event: MouseEvent): void {
    if (!column.resizable) return;
    
    event.preventDefault();
    this.resizingColumn = column;
    this.resizeStartX = event.clientX;
    this.resizeStartWidth = column.width || 100;
    
    document.addEventListener('mousemove', this.onColumnResizeMove);
    document.addEventListener('mouseup', this.onColumnResizeEnd);
  }

  /**
   * Handle column resize move
   */
  private onColumnResizeMove = (event: MouseEvent): void => {
    if (!this.resizingColumn) return;
    
    const deltaX = event.clientX - this.resizeStartX;
    const newWidth = Math.max(
      this.resizingColumn.minWidth || 50,
      Math.min(
        this.resizingColumn.maxWidth || 1000,
        this.resizeStartWidth + deltaX
      )
    );
    
    this.resizingColumn.width = newWidth;
    this.stateService.setColumnWidth(this.resizingColumn.field, newWidth);
    this.cdr.markForCheck();
  };

  /**
   * Handle column resize end
   */
  private onColumnResizeEnd = (): void => {
    if (!this.resizingColumn) return;
    
    const resizeEvent: ColumnResizeEvent = {
      column: this.resizingColumn,
      width: this.resizingColumn.width || 100,
      oldWidth: this.resizeStartWidth
    };
    
    this.columnResize.emit(resizeEvent);
    if (this.events?.columnResize) {
      this.events.columnResize(resizeEvent);
    }
    
    this.resizingColumn = null;
    document.removeEventListener('mousemove', this.onColumnResizeMove);
    document.removeEventListener('mouseup', this.onColumnResizeEnd);
    this.cdr.markForCheck();
  };

  /**
   * Handle column drag start
   */
  onColumnDragStart(column: ColumnDef<T>, event: DragEvent): void {
    if (!this.options.columnReorder) return;
    
    this.draggedColumn = column;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', column.field);
    }
  }

  /**
   * Handle column drag over
   */
  onColumnDragOver(column: ColumnDef<T>, index: number, event: DragEvent): void {
    if (!this.draggedColumn || this.draggedColumn === column) return;
    
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dragOverIndex = index;
    this.cdr.markForCheck();
  }

  /**
   * Handle column drop
   */
  onColumnDrop(column: ColumnDef<T>, index: number, event: DragEvent): void {
    event.preventDefault();
    
    if (!this.draggedColumn || this.draggedColumn === column) return;
    
    const fromIndex = this.visibleColumns.indexOf(this.draggedColumn);
    const toIndex = index;
    
    // Reorder columns
    const columns = [...this.visibleColumns];
    columns.splice(fromIndex, 1);
    columns.splice(toIndex, 0, this.draggedColumn);
    
    this.visibleColumns = columns;
    this.stateService.setColumnOrder(columns.map(c => c.field));
    
    const reorderEvent: ColumnReorderEvent = {
      column: this.draggedColumn,
      fromIndex,
      toIndex
    };
    
    this.columnReorder.emit(reorderEvent);
    if (this.events?.columnReorder) {
      this.events.columnReorder(reorderEvent);
    }
    
    this.draggedColumn = null;
    this.dragOverIndex = -1;
    this.cdr.markForCheck();
  }

  /**
   * Handle column drag end
   */
  onColumnDragEnd(): void {
    this.draggedColumn = null;
    this.dragOverIndex = -1;
    this.cdr.markForCheck();
  }

  /**
   * Export data - exports only selected rows
   */
  exportData(format: 'csv' | 'excel' | 'pdf'): void {
    const columns = this.visibleColumns;
    const sort = this.stateService.getSort().filter(s => s.direction !== SortDirection.None);
    const filters = this.stateService.getFilters();
    const groups = this.stateService.getGroups();
    const exportEvent: ExportRequestEvent = {
      format,
      sort,
      filters,
      groups,
      columns: columns.map(col => ({ field: col.field, title: col.title })),
      search: this.searchTerm
    };

    this.exportRequest.emit(exportEvent);
    if (this.events?.exportRequest) {
      this.events.exportRequest(exportEvent);
    }
  }

  /**
   * Get field value from object
   */
  getFieldValue(obj: any, field: string): any {
    return field.split('.').reduce((o, p) => o?.[p], obj);
  }

  /**
   * Format cell value
   */
  formatCellValue(value: any, row: T, column: ColumnDef<T>): string {
    if (column.valueFormatter) {
      return column.valueFormatter(value, row, column);
    }
    
    // Handle null/undefined
    if (value == null) {
      return '';
    }
    
    // Handle objects - show neutral badge text instead of [object Object]
    if (typeof value === 'object' && !Array.isArray(value) && value.constructor === Object) {
      return 'Object';
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
      return `[${value.length} items]`;
    }
    
    return String(value);
  }

  /**
   * Emit selection change
   */
  private emitSelectionChange(): void {
    const event: SelectionChangeEvent<T> = {
      selectedRows: this.selectedRows,
      selectedKeys: this.selectedKeys,
      currentRow: this.currentRow || undefined
    };
    this.selectionChange.emit(event);
    if (this.events?.selectionChange) {
      this.events.selectionChange(event);
    }
  }

  /**
   * Emit sort change
   */
  private emitSortChange(event: SortChangeEvent): void {
    this.sortChange.emit(event);
  }

  /**
   * Emit data state change
   */
  private emitDataStateChange(params: DataSourceParams): void {
    const event: DataStateChangeEvent = {
      skip: params.skip || 0,
      take: params.take || this.pageSize,
      sort: params.sort,
      filters: params.filters,
      groups: params.groups
    };
    this.dataStateChange.emit(event);
    if (this.events?.dataStateChange) {
      this.events.dataStateChange(event);
    }
  }

  /**
   * Emit dataStateChange for Observable data sources when groups change manually
   */
  private emitDataStateChangeForGroups(groups: GroupConfig[]): void {
    const sort = this.stateService.getSort();
    const filters = this.stateService.getFilters();
    const page = this.stateService.getPage();
    const pageSize = this.stateService.getPageSize();
    const skip = (page - 1) * pageSize;
    
    const event: DataStateChangeEvent = {
      skip,
      take: pageSize,
      sort,
      filters,
      groups
    };
    this.dataStateChange.emit(event);
    if (this.events?.dataStateChange) {
      this.events.dataStateChange(event);
    }
  }

  /**
   * Load persisted settings
   */
  private loadPersistedSettings(): void {
    if (!this.options.persistSettings || !this.options.settingsKey) return;
    
    const settings = this.persistenceService.loadSettings(this.options.settingsKey);
    if (settings) {
      this.persistenceService.applySettings(this.stateService, settings);
    }
  }

  /**
   * Save persisted settings
   */
  private savePersistedSettings(): void {
    if (!this.options.persistSettings || !this.options.settingsKey) return;
    
    const settings = this.persistenceService.extractSettings(this.stateService);
    this.persistenceService.saveSettings(this.options.settingsKey, settings);
  }

  /**
   * Get total pages
   */
  getTotalPages(): number {
    return Math.ceil(this.total / this.pageSize);
  }

  /**
   * Get sort direction for column
   */
  getSortDirection(column: ColumnDef<T>): 'asc' | 'desc' | null {
    const sort = this.stateService.getSort().find(s => s.field === column.field);
    if (!sort || sort.direction === 'none' as any) return null;
    return sort.direction === 'asc' ? 'asc' : 'desc';
  }

  /**
   * Get column title by field
   */
  getColumnTitle(field: string): string {
    const column = this.columns.find(c => c.field === field);
    return column?.title || column?.field || field;
  }

  /**
   * Get column by field (for template use)
   */
  getColumnByField(field: string): ColumnDef<T> | undefined {
    return this.columns.find(c => c.field === field);
  }

  /**
   * Get current groups
   */
  getCurrentGroups(): GroupConfig[] {
    return this.stateService.getGroups();
  }

  /**
   * Toggle group panel visibility
   */
  toggleGroupPanel(): void {
    this.showGroupPanel = !this.showGroupPanel;
    this.cdr.markForCheck();
  }

  /**
   * Add group by column
   */
  addGroupByColumn(column: ColumnDef<T>): void {
    if (!column.groupable && column.groupable !== undefined) {
      return; // Column is not groupable
    }

    const currentGroups = this.getCurrentGroups();
    const existingIndex = currentGroups.findIndex(g => g.field === column.field);
    
    if (existingIndex >= 0) {
      return; // Already grouped by this column
    }

    const newGroup: GroupConfig = {
      field: column.field,
      direction: SortDirection.Asc
    };

    const updatedGroups = [...currentGroups, newGroup];
    this.stateService.setGroups(updatedGroups);
    // For Observable data sources, emit dataStateChange to notify parent of group change
    if (this.isObservableDataSource) {
      this.emitDataStateChangeForGroups(updatedGroups);
    }
    this.cdr.markForCheck();
  }

  /**
   * Remove group
   */
  removeGroup(index: number): void {
    const currentGroups = this.getCurrentGroups();
    const updatedGroups = currentGroups.filter((_, i) => i !== index);
    this.stateService.setGroups(updatedGroups);
    // For Observable data sources, emit dataStateChange to notify parent of group change
    if (this.isObservableDataSource) {
      this.emitDataStateChangeForGroups(updatedGroups);
    }
    this.cdr.markForCheck();
  }

  /**
   * Reorder groups
   */
  reorderGroups(fromIndex: number, toIndex: number): void {
    const currentGroups = this.getCurrentGroups();
    const updatedGroups = [...currentGroups];
    const [removed] = updatedGroups.splice(fromIndex, 1);
    updatedGroups.splice(toIndex, 0, removed);
    this.stateService.setGroups(updatedGroups);
    // For Observable data sources, emit dataStateChange to notify parent of group change
    if (this.isObservableDataSource) {
      this.emitDataStateChangeForGroups(updatedGroups);
    }
    this.cdr.markForCheck();
  }

  /**
   * Toggle group sort direction
   */
  toggleGroupDirection(index: number): void {
    const currentGroups = this.getCurrentGroups();
    const updatedGroups = [...currentGroups];
    const group = updatedGroups[index];
    updatedGroups[index] = {
      ...group,
      direction: group.direction === SortDirection.Asc ? SortDirection.Desc : SortDirection.Asc
    };
    this.stateService.setGroups(updatedGroups);
    // For Observable data sources, emit dataStateChange to notify parent of group change
    if (this.isObservableDataSource) {
      this.emitDataStateChangeForGroups(updatedGroups);
    }
    this.cdr.markForCheck();
  }

  /**
   * Handle column drag start for group panel
   */
  onColumnDragStartForGroup(column: ColumnDef<T>, event: DragEvent): void {
    this.draggedColumn = column;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', column.field);
      event.dataTransfer.setData('application/json', JSON.stringify({ type: 'column', field: column.field }));
    }
  }

  /**
   * Handle group panel drag over
   */
  onGroupPanelDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  /**
   * Handle group panel drop
   */
  onGroupPanelDrop(event: DragEvent): void {
    event.preventDefault();
    
    if (!this.draggedColumn) return;

    try {
      const data = event.dataTransfer?.getData('application/json');
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.type === 'column') {
          const column = this.columns.find(c => c.field === parsed.field);
          if (column) {
            this.addGroupByColumn(column);
          }
        }
      } else {
        // Fallback to draggedColumn
        this.addGroupByColumn(this.draggedColumn);
      }
    } catch (e) {
      // Fallback to draggedColumn
      if (this.draggedColumn) {
        this.addGroupByColumn(this.draggedColumn);
      }
    }

    this.draggedColumn = null;
    this.cdr.markForCheck();
  }

  /**
   * Handle group item drag start
   */
  onGroupItemDragStart(group: GroupConfig, index: number, event: DragEvent): void {
    this.draggedGroupIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/json', JSON.stringify({ type: 'group', index }));
    }
  }

  /**
   * Handle group item drag over
   */
  onGroupItemDragOver(index: number, event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dragOverIndex = index;
    this.cdr.markForCheck();
  }

  /**
   * Handle group item drop
   */
  onGroupItemDrop(index: number, event: DragEvent): void {
    event.preventDefault();
    
    if (this.draggedGroupIndex >= 0 && this.draggedGroupIndex !== index) {
      this.reorderGroups(this.draggedGroupIndex, index);
    }

    this.draggedGroupIndex = -1;
    this.dragOverIndex = -1;
    this.cdr.markForCheck();
  }

  /**
   * Check if column is already grouped
   */
  isColumnGrouped(column: ColumnDef<T>): boolean {
    return this.getCurrentGroups().some(g => g.field === column.field);
  }

  /**
   * Get groupable columns
   */
  getGroupableColumns(): ColumnDef<T>[] {
    return this.visibleColumns.filter(col => 
      col.groupable !== false && 
      !this.isColumnGrouped(col)
    );
  }

}


