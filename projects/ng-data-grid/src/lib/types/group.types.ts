import { AggregateResult } from './column.types';

/**
 * Group row type indicator
 */
export const GROUP_ROW_TYPE = '__GROUP_ROW__';

/**
 * Group row interface
 */
export interface GroupRow<T = any> {
  /** Type indicator */
  __type: typeof GROUP_ROW_TYPE;
  /** Group level (0-based) */
  level: number;
  /** Group field */
  field: string;
  /** Group value */
  value: any;
  /** Group key (unique identifier) */
  key: string;
  /** Whether group is expanded */
  expanded: boolean;
  /** Child rows count */
  count: number;
  /** Child data rows */
  children: T[];
  /** Aggregates for this group */
  aggregates?: AggregateResult[];
  /** Parent group key (if nested) */
  parentKey?: string;
}

/**
 * Check if a row is a group row
 */
export function isGroupRow<T>(row: T | GroupRow<T>): row is GroupRow<T> {
  return (row as any)?.__type === GROUP_ROW_TYPE;
}

/**
 * Grid row type (can be data row or group row)
 */
export type GridRow<T = any> = T | GroupRow<T>;

