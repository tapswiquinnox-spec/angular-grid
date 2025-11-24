import { Observable } from 'rxjs';
import { ColumnDef, SortConfig, FilterCondition, GroupConfig, SelectionMode, EditMode } from './column.types';

/**
 * Page result for server-side data
 */
export interface PageResult<T> {
  data: T[];
  total: number;
  page?: number;
  pageSize?: number;
}

/**
 * Data source type - can be static array or server-side function
 */
export type DataSource<T> = T[] | Observable<PageResult<T>> | ((params: DataSourceParams) => Observable<PageResult<T>>);

/**
 * Data source parameters for server-side requests
 */
export interface DataSourceParams {
  page?: number;
  pageSize?: number;
  sort?: SortConfig[];
  filters?: FilterCondition[];
  groups?: GroupConfig[];
  skip?: number;
  take?: number;
  infiniteScroll?: boolean;
}

/**
 * Grid options interface
 */
export interface GridOptions<T = any> {
  /** Column definitions */
  columns: ColumnDef<T>[];
  /** Data source */
  dataSource: DataSource<T>;
  /** Page size options */
  pageSizeOptions?: number[];
  /** Default page size */
  defaultPageSize?: number;
  /** Default sort configuration */
  defaultSort?: SortConfig[];
  /** Default filter conditions */
  defaultFilters?: FilterCondition[];
  /** Default group configuration */
  defaultGroups?: GroupConfig[];
  /** Whether grid is editable */
  editable?: boolean;
  /** Edit mode */
  editMode?: EditMode;
  /** Selection mode */
  selectionMode?: SelectionMode;
  /** Unique row key field */
  rowKey?: string | ((row: T) => any);
  /** Row height in pixels */
  rowHeight?: number;
  /** Header height in pixels */
  headerHeight?: number;
  /** Whether to show header */
  showHeader?: boolean;
  /** Whether to show footer */
  showFooter?: boolean;
  /** Whether to enable virtualization */
  virtualScroll?: boolean;
  /** Virtual scroll buffer size */
  virtualScrollBuffer?: number;
  /** Whether to enable infinite scroll (for server-side data) */
  infiniteScroll?: boolean;
  /** Infinite scroll threshold (percentage from bottom to trigger load) */
  infiniteScrollThreshold?: number;
  /** Whether to enable global search */
  enableSearch?: boolean;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Columns to search in (if not specified, searches all searchable columns) */
  searchableColumns?: string[];
  /** Whether to enable column filters in header */
  enableColumnFilters?: boolean;
  /** Whether to enable column reordering */
  columnReorder?: boolean;
  /** Whether to enable column resizing */
  columnResize?: boolean;
  /** Whether to persist settings */
  persistSettings?: boolean;
  /** Settings persistence key */
  settingsKey?: string;
  /** Whether to enable RTL */
  rtl?: boolean;
  /** Custom CSS class */
  cssClass?: string;
  /** Whether to show loading indicator */
  showLoading?: boolean;
  /** Loading template */
  loadingTemplate?: any;
  /** Empty data template */
  emptyTemplate?: any;
  /** Row template */
  rowTemplate?: any;
  /** Whether to enable keyboard navigation */
  keyboardNavigation?: boolean;
  /** Whether to enable row drag and drop */
  rowDragDrop?: boolean;
  /** Whether to show column chooser */
  showColumnChooser?: boolean;
  /** Whether to enable export */
  enableExport?: boolean;
  /** Export formats */
  exportFormats?: ('csv' | 'excel' | 'pdf')[];
  /** Whether to show row numbers */
  showRowNumbers?: boolean;
  /** Whether to enable row detail panel */
  rowDetail?: boolean;
  /** Row detail template */
  rowDetailTemplate?: any;
  /** Frozen header while scrolling */
  frozenHeader?: boolean;
  /** Custom theme */
  theme?: 'light' | 'dark' | 'auto';
}

/**
 * Grid events
 */
export interface GridEvents<T = any> {
  rowClick?: (event: RowClickEvent<T>) => void;
  cellClick?: (event: CellClickEvent<T>) => void;
  rowDoubleClick?: (event: RowClickEvent<T>) => void;
  cellDoubleClick?: (event: CellClickEvent<T>) => void;
  selectionChange?: (event: SelectionChangeEvent<T>) => void;
  sortChange?: (event: SortChangeEvent) => void;
  filterChange?: (event: FilterChangeEvent) => void;
  pageChange?: (event: PageChangeEvent) => void;
  editStart?: (event: EditEvent<T>) => void;
  editSave?: (event: EditEvent<T>) => void;
  editCancel?: (event: EditEvent<T>) => void;
  dataStateChange?: (event: DataStateChangeEvent) => void;
  columnReorder?: (event: ColumnReorderEvent) => void;
  columnResize?: (event: ColumnResizeEvent) => void;
  rowDragStart?: (event: RowDragEvent<T>) => void;
  rowDragEnd?: (event: RowDragEvent<T>) => void;
}

/**
 * Row click event
 */
export interface RowClickEvent<T> {
  row: T;
  rowIndex: number;
  event: MouseEvent;
}

/**
 * Cell click event
 */
export interface CellClickEvent<T> {
  row: T;
  rowIndex: number;
  column: ColumnDef<T>;
  columnIndex: number;
  value: any;
  event: MouseEvent;
}

/**
 * Selection change event
 */
export interface SelectionChangeEvent<T> {
  selectedRows: T[];
  selectedKeys: any[];
  currentRow?: T;
}

/**
 * Sort change event
 */
export interface SortChangeEvent {
  sort: SortConfig[];
}

/**
 * Filter change event
 */
export interface FilterChangeEvent {
  filters: FilterCondition[];
}

/**
 * Page change event
 */
export interface PageChangeEvent {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

/**
 * Edit event
 */
export interface EditEvent<T> {
  row: T;
  rowIndex: number;
  column?: ColumnDef<T>;
  columnIndex?: number;
  oldValue?: any;
  newValue?: any;
}

/**
 * Data state change event
 */
export interface DataStateChangeEvent {
  skip: number;
  take: number;
  sort?: SortConfig[];
  filters?: FilterCondition[];
  groups?: GroupConfig[];
}

/**
 * Column reorder event
 */
export interface ColumnReorderEvent {
  column: ColumnDef;
  fromIndex: number;
  toIndex: number;
}

/**
 * Column resize event
 */
export interface ColumnResizeEvent {
  column: ColumnDef;
  width: number;
  oldWidth: number;
}

/**
 * Row drag event
 */
export interface RowDragEvent<T> {
  row: T;
  rowIndex: number;
  event: DragEvent;
}


