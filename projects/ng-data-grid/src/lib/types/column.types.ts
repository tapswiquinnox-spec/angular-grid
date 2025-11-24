import { TemplateRef } from '@angular/core';

/**
 * Column data types for filtering and formatting
 */
export enum ColumnType {
  String = 'string',
  Number = 'number',
  Date = 'date',
  Boolean = 'boolean',
  Custom = 'custom'
}

/**
 * Filter operators
 */
export enum FilterOperator {
  Equals = 'equals',
  NotEquals = 'notEquals',
  Contains = 'contains',
  NotContains = 'notContains',
  StartsWith = 'startsWith',
  EndsWith = 'endsWith',
  GreaterThan = 'greaterThan',
  GreaterThanOrEqual = 'greaterThanOrEqual',
  LessThan = 'lessThan',
  LessThanOrEqual = 'lessThanOrEqual',
  Between = 'between',
  In = 'in',
  NotIn = 'notIn',
  IsNull = 'isNull',
  IsNotNull = 'isNotNull'
}

/**
 * Sort direction
 */
export enum SortDirection {
  None = 'none',
  Asc = 'asc',
  Desc = 'desc'
}

/**
 * Selection mode
 */
export enum SelectionMode {
  None = 'none',
  Single = 'single',
  Multiple = 'multiple',
  Range = 'range'
}

/**
 * Edit mode
 */
export enum EditMode {
  None = 'none',
  Cell = 'cell',
  Row = 'row',
  Inline = 'inline',
  Popup = 'popup'
}

/**
 * Column definition interface
 */
export interface ColumnDef<T = any> {
  /** Unique identifier for the column */
  field: string;
  /** Display title */
  title?: string;
  /** Column data type */
  type?: ColumnType;
  /** Column width in pixels */
  width?: number;
  /** Minimum column width */
  minWidth?: number;
  /** Maximum column width */
  maxWidth?: number;
  /** Whether column is sortable */
  sortable?: boolean;
  /** Whether column is filterable */
  filterable?: boolean;
  /** Whether column is editable */
  editable?: boolean;
  /** Whether column is resizable */
  resizable?: boolean;
  /** Whether column is visible */
  visible?: boolean;
  /** Whether column is pinned (left or right) */
  pinned?: 'left' | 'right' | false;
  /** Column alignment */
  align?: 'left' | 'center' | 'right';
  /** Custom cell template */
  cellTemplate?: TemplateRef<any>;
  /** Custom header template */
  headerTemplate?: TemplateRef<any>;
  /** Custom filter template */
  filterTemplate?: TemplateRef<any>;
  /** Custom cell renderer function */
  cellRenderer?: (value: any, row: T, column: ColumnDef<T>) => string | HTMLElement;
  /** Value formatter function */
  valueFormatter?: (value: any, row: T, column: ColumnDef<T>) => string;
  /** Value parser function for editing */
  valueParser?: (value: string, row: T, column: ColumnDef<T>) => any;
  /** Custom CSS class */
  cssClass?: string;
  /** Custom header CSS class */
  headerCssClass?: string;
  /** Aggregate function for grouping */
  aggregate?: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'custom';
  /** Custom aggregate function */
  aggregateFn?: (values: any[]) => any;
  /** Whether column can be grouped */
  groupable?: boolean;
  /** Default filter value */
  defaultFilter?: FilterCondition;
  /** Default sort direction */
  defaultSort?: SortDirection;
  /** Tooltip text */
  tooltip?: string;
  /** Custom comparator for sorting */
  comparator?: (a: any, b: any) => number;
}

/**
 * Filter condition
 */
export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value?: any;
  value2?: any; // For 'between' operator
}

/**
 * Sort configuration
 */
export interface SortConfig {
  field: string;
  direction: SortDirection;
}

/**
 * Group configuration
 */
export interface GroupConfig {
  field: string;
  direction?: SortDirection;
}

/**
 * Aggregate result
 */
export interface AggregateResult {
  field: string;
  aggregate: string;
  value: any;
}


