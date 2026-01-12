import { Injectable } from '@angular/core';
import { Observable, of, BehaviorSubject, combineLatest } from 'rxjs';
import { map, switchMap, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { 
  DataSource, 
  DataSourceParams, 
  PageResult, 
  SortConfig, 
  FilterCondition, 
  GroupConfig,
  SortDirection,
  FilterOperator,
  ColumnType,
  ColumnDef,
  GroupRow,
  GridRow,
  isGroupRow,
  GROUP_ROW_TYPE,
  AggregateResult
} from '../types';
import { orderBy, filter as lodashFilter, groupBy, sumBy, meanBy, minBy, maxBy } from 'lodash-es';

// Check if we're in production mode (simplified check)
const isProduction = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? false : true);

/**
 * Service for handling data operations (client-side and server-side)
 */
@Injectable()
export class DataService<T = any> {
  private dataSource$ = new BehaviorSubject<DataSource<T>>([]);
  private currentData$ = new BehaviorSubject<T[]>([]);
  private total$ = new BehaviorSubject<number>(0);
  
  constructor() {}

  /**
   * Set data source
   */
  setDataSource(dataSource: DataSource<T>): void {
    // Only log in development mode
    if (!isProduction) {
      const isObservable = dataSource && typeof (dataSource as any).subscribe === 'function';
      console.log('[DataService] setDataSource', {
        type: Array.isArray(dataSource) ? 'CLIENT-SIDE (array)' : typeof dataSource === 'function' ? 'SERVER-SIDE (function)' : isObservable ? 'SERVER-SIDE (observable)' : 'unknown',
        isArray: Array.isArray(dataSource),
        isFunction: typeof dataSource === 'function',
        isObservable: isObservable
      });
    }
    this.dataSource$.next(dataSource);
  }

  /**
   * Get data with pagination, sorting, filtering, and grouping
   */
  getData(params: DataSourceParams, columns?: ColumnDef<T>[]): Observable<PageResult<GridRow<T>>> {
    const dataSource = this.dataSource$.value;
    
    // Detect data source type properly
    const isArray = Array.isArray(dataSource);
    const isFunction = typeof dataSource === 'function';
    const isObs = !isArray && !isFunction && dataSource && typeof (dataSource as any).subscribe === 'function';
    
    // Only log in development mode and only once per request
    if (!isProduction) {
      console.log('[DataService] getData', {
        type: isArray ? 'CLIENT-SIDE (array)' : isFunction ? 'SERVER-SIDE (function)' : isObs ? 'SERVER-SIDE (observable)' : 'unknown',
        page: params.page,
        pageSize: params.pageSize
      });
    }
    
    if (isArray) {
      return this.getClientSideData(dataSource as T[], params, columns);
    } else if (isFunction) {
      // Server-side function - call it with params
      return (dataSource as (params: DataSourceParams) => Observable<PageResult<T>>)(params).pipe(
        map((result: PageResult<T>) => {
          if (!isProduction) {
            console.log('[DataService] Server response (function)', {
              dataCount: result.data?.length || 0,
              total: result.total
            });
          }
          return this.processGrouping(result, params, columns);
        })
      );
    } else if (isObs) {
      // Server-side Observable - apply client-side operations
      return (dataSource as Observable<PageResult<T>>).pipe(
        map((result: PageResult<T>) => {
          if (!isProduction) {
            console.log('[DataService] Server response (observable)', {
              dataCount: result.data?.length || 0,
              total: result.total
            });
          }
          return this.applyClientSideOperations(result, params, columns);
        })
      );
    } else {
      // Fallback: treat as empty array
      console.warn('[DataService] Unknown data source type, using empty array');
      return of({ data: [], total: 0, page: params.page, pageSize: params.pageSize });
    }
  }

  /**
   * Get client-side data with operations
   */
  private getClientSideData(data: T[], params: DataSourceParams, columns?: ColumnDef<T>[]): Observable<PageResult<GridRow<T>>> {
    let result: T[] = [...data];
    
    // Apply filters
    if (params.filters && params.filters.length > 0) {
      result = this.applyFilters(result, params.filters);
    }
    
    // Total is always the count of data rows (not group rows)
    const total = result.length;
    
    // Apply sorting BEFORE grouping (to preserve group structure)
    if (params.sort && params.sort.length > 0) {
      result = this.applySorting(result, params.sort);
    }
    
    // Apply grouping (creates group rows) - preserves sorted order
    let groupedResult: GridRow<T>[] = result;
    if (params.groups && params.groups.length > 0) {
      groupedResult = this.applyGrouping(result, params.groups, columns);
      
      // Apply pagination to grouped result with group row preservation
      // Skip pagination when infinite scroll is enabled (it accumulates all data)
      if (params.skip !== undefined && params.take !== undefined && !params.infiniteScroll) {
        groupedResult = this.applyPaginationWithGroupRows(groupedResult, params.skip, params.take);
      }
      
      return of({
        data: groupedResult,
        total: total, // Return original data count, not grouped row count
        page: params.page,
        pageSize: params.pageSize
      });
    }
    
    // Apply pagination when NOT grouping
    if (params.skip !== undefined && params.take !== undefined) {
      groupedResult = groupedResult.slice(params.skip, params.skip + params.take);
    }
    
    return of({
      data: groupedResult,
      total: total,
      page: params.page,
      pageSize: params.pageSize
    });
  }

  /**
   * Apply client-side operations to server-side result
   */
  private applyClientSideOperations(result: PageResult<T>, params: DataSourceParams, columns?: ColumnDef<T>[]): PageResult<GridRow<T>> {
    // Check if data is already grouped (contains group rows)
    const isAlreadyGrouped = result.data && result.data.length > 0 && result.data.some((row: any) => isGroupRow(row));
    
    if (isAlreadyGrouped) {
      // Data is already grouped by server - return as-is without re-grouping
      // This preserves the server's grouping structure and child order
      return {
        ...result,
        data: result.data as GridRow<T>[],
        total: result.total
      };
    }
    
    let data: T[] = [...result.data];
    
    // Apply filters (if server didn't handle them)
    if (params.filters && params.filters.length > 0) {
      data = this.applyFilters(data, params.filters);
    }
    
    // Total should be the original data count, not grouped row count
    const total = result.total;
    
    // Apply sorting BEFORE grouping (to preserve group structure)
    if (params.sort && params.sort.length > 0) {
      data = this.applySorting(data, params.sort);
    }
    
    // Process grouping if needed
    let processedData: GridRow<T>[] = data;
    if (params.groups && params.groups.length > 0) {
      processedData = this.applyGrouping(data, params.groups, columns);
    }
    
    return {
      ...result,
      data: processedData,
      total: total // Return original data count, not grouped row count
    };
  }

  /**
   * Process grouping for server-side data
   * Note: Server should handle grouping, but we apply client-side grouping if server doesn't
   */
  private processGrouping(result: PageResult<T>, params: DataSourceParams, columns?: ColumnDef<T>[]): PageResult<GridRow<T>> {
    if (!params.groups || params.groups.length === 0) {
      return { ...result, data: result.data };
    }
    
    // Total should be the original data count, not grouped row count
    const total = result.total;
    
    // Apply client-side grouping to the server result
    // In a real scenario, the server should handle grouping and return grouped data
    // But we support client-side grouping as fallback
    const groupedData = this.applyGrouping(result.data, params.groups, columns);
    
    return {
      ...result,
      data: groupedData,
      total: total // Return original data count, not grouped row count
    };
  }

  /**
   * Apply filters to data
   */
  private applyFilters(data: T[], filters: FilterCondition[]): T[] {
    return data.filter(row => {
      return filters.every(filter => this.matchesFilter(row, filter));
    });
  }

  /**
   * Check if row matches filter condition
   */
  private matchesFilter(row: T, filter: FilterCondition): boolean {
    const value = this.getFieldValue(row, filter.field);
    const operator = filter.operator;
    const filterValue = filter.value;
    
    switch (operator) {
      case FilterOperator.Equals:
        return value === filterValue;
      case FilterOperator.NotEquals:
        return value !== filterValue;
      case FilterOperator.Contains:
        return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
      case FilterOperator.NotContains:
        return !String(value).toLowerCase().includes(String(filterValue).toLowerCase());
      case FilterOperator.StartsWith:
        return String(value).toLowerCase().startsWith(String(filterValue).toLowerCase());
      case FilterOperator.EndsWith:
        return String(value).toLowerCase().endsWith(String(filterValue).toLowerCase());
      case FilterOperator.GreaterThan:
        return Number(value) > Number(filterValue);
      case FilterOperator.GreaterThanOrEqual:
        return Number(value) >= Number(filterValue);
      case FilterOperator.LessThan:
        return Number(value) < Number(filterValue);
      case FilterOperator.LessThanOrEqual:
        return Number(value) <= Number(filterValue);
      case FilterOperator.Between:
        return Number(value) >= Number(filterValue) && Number(value) <= Number(filter.value2);
      case FilterOperator.In:
        return Array.isArray(filterValue) && filterValue.includes(value);
      case FilterOperator.NotIn:
        return Array.isArray(filterValue) && !filterValue.includes(value);
      case FilterOperator.IsNull:
        return value === null || value === undefined;
      case FilterOperator.IsNotNull:
        return value !== null && value !== undefined;
      default:
        return true;
    }
  }

  /**
   * Apply sorting to data
   */
  private applySorting(data: T[], sorts: SortConfig[]): T[] {
    const sortFields = sorts
      .filter(s => s.direction !== SortDirection.None)
      .map(s => s.field);
    const sortOrders = sorts
      .filter(s => s.direction !== SortDirection.None)
      .map(s => s.direction === SortDirection.Asc ? 'asc' : 'desc');
    
    if (sortFields.length === 0) {
      return data;
    }
    
    return orderBy(data, sortFields, sortOrders);
  }

  /**
   * Apply grouping to data with group rows and aggregates
   */
  private applyGrouping(data: T[], groups: GroupConfig[], columns?: ColumnDef<T>[]): GridRow<T>[] {
    if (groups.length === 0) {
      return data;
    }
    
    return this.createGroupRows(data, groups, 0, columns);
  }

  /**
   * Create group rows recursively
   */
  private createGroupRows(data: T[], groups: GroupConfig[], level: number, columns?: ColumnDef<T>[], parentKey?: string): GridRow<T>[] {
    if (level >= groups.length) {
      return data;
    }

    const groupConfig = groups[level];
    const grouped = groupBy(data, (row: T) => {
      const value = this.getFieldValue(row, groupConfig.field);
      return value != null ? String(value) : '(null)';
    });

    const result: GridRow<T>[] = [];
    const sortedGroups = Object.entries(grouped).sort((a, b) => {
      if (groupConfig.direction === SortDirection.Desc) {
        return b[0].localeCompare(a[0]);
      }
      return a[0].localeCompare(b[0]);
    });

    for (const [key, groupData] of sortedGroups) {
      const groupValue = key === '(null)' ? null : key;
      const groupRowKey = parentKey ? `${parentKey}|${key}` : key;
      
      // Calculate aggregates for this group
      const aggregates = columns 
        ? this.calculateGroupAggregates(groupData, columns)
        : [];

      // Create group row
      const groupRow: GroupRow<T> = {
        __type: GROUP_ROW_TYPE,
        level,
        field: groupConfig.field,
        value: groupValue,
        key: groupRowKey,
        expanded: true, // Default to expanded (will be managed by component)
        count: groupData.length,
        children: groupData,
        aggregates,
        parentKey
      };

      result.push(groupRow);

      // Recursively create nested groups or data rows
      // These will be filtered based on expansion state in the component
      if (level + 1 < groups.length) {
        const nestedRows = this.createGroupRows(groupData, groups, level + 1, columns, groupRowKey);
        result.push(...nestedRows);
      } else {
        // Add data rows directly under this group
        result.push(...groupData);
      }
    }

    return result;
  }

  /**
   * Calculate aggregates for a group
   */
  private calculateGroupAggregates(data: T[], columns: ColumnDef<T>[]): AggregateResult[] {
    const aggregates: AggregateResult[] = [];

    for (const column of columns) {
      if (column.aggregate && column.aggregate !== 'custom') {
        const value = this.calculateAggregates(data, column.field, column.aggregate);
        aggregates.push({
          field: column.field,
          aggregate: column.aggregate,
          value
        });
      } else if (column.aggregate === 'custom' && column.aggregateFn) {
        const values = data.map(row => this.getFieldValue(row, column.field)).filter(v => v != null);
        const value = column.aggregateFn(values);
        aggregates.push({
          field: column.field,
          aggregate: 'custom',
          value
        });
      }
    }

    return aggregates;
  }

  /**
   * Apply sorting with group rows
   */
  private applySortingWithGroups(data: GridRow<T>[], sorts: SortConfig[]): GridRow<T>[] {
    const sortFields = sorts
      .filter(s => s.direction !== SortDirection.None)
      .map(s => s.field);
    const sortOrders = sorts
      .filter(s => s.direction !== SortDirection.None)
      .map(s => s.direction === SortDirection.Asc ? 'asc' : 'desc');
    
    if (sortFields.length === 0) {
      return data;
    }

    return data.sort((a, b) => {
      // Group rows always come before data rows in their group
      const aIsGroup = isGroupRow(a);
      const bIsGroup = isGroupRow(b);
      
      if (aIsGroup && bIsGroup) {
        // Both are groups - compare by group value
        const aGroup = a as GroupRow<T>;
        const bGroup = b as GroupRow<T>;
        for (let i = 0; i < sortFields.length; i++) {
          const field = sortFields[i];
          const order = sortOrders[i];
          
          if (aGroup.field === field) {
            const aVal = aGroup.value;
            const bVal = bGroup.value;
            let comparison = 0;
            
            if (aVal > bVal) comparison = 1;
            else if (aVal < bVal) comparison = -1;
            
            if (order === 'desc') comparison *= -1;
            if (comparison !== 0) return comparison;
          }
        }
        return 0;
      }
      
      if (aIsGroup) return -1;
      if (bIsGroup) return 1;
      
      // Both are data rows - normal sorting
      for (let i = 0; i < sortFields.length; i++) {
        const field = sortFields[i];
        const order = sortOrders[i];
        const aVal = this.getFieldValue(a as T, field);
        const bVal = this.getFieldValue(b as T, field);
        let comparison = 0;
        
        if (aVal > bVal) comparison = 1;
        else if (aVal < bVal) comparison = -1;
        
        if (order === 'desc') comparison *= -1;
        if (comparison !== 0) return comparison;
      }
      
      return 0;
    });
  }

  /**
   * Get field value from object using dot notation
   */
  private getFieldValue(obj: any, field: string): any {
    return field.split('.').reduce((o, p) => o?.[p], obj);
  }

  /**
   * Apply pagination while preserving group rows across pages
   * Ensures group rows are visible on all pages that contain their children
   */
  private applyPaginationWithGroupRows(data: GridRow<T>[], skip: number, take: number): GridRow<T>[] {
    if (data.length === 0) return [];
    
    const result: GridRow<T>[] = [];
    let dataRowCount = 0;
    let i = 0;
    const activeGroupKeys = new Set<string>();
    
    // First pass: identify which groups have data rows in the page range
    let currentDataIndex = 0;
    for (let j = 0; j < data.length; j++) {
      const row = data[j];
      if (isGroupRow(row)) {
        // Check if this group has data rows in the page range
        let groupDataStart = currentDataIndex;
        let groupDataEnd = currentDataIndex;
        
        // Count data rows in this group
        let k = j + 1;
        while (k < data.length) {
          const nextRow = data[k];
          if (isGroupRow(nextRow)) {
            if (nextRow.level <= row.level) {
              break; // Next group at same or higher level
            }
            k++; // Nested group, continue
          } else {
            // Data row - check if it belongs to this group
            const rowValue = this.getFieldValue(nextRow as T, row.field);
            if (String(rowValue) === String(row.value)) {
              groupDataEnd++;
              k++;
            } else {
              break; // Doesn't belong to this group
            }
          }
        }
        
        // If this group has data rows in the page range, mark it as active
        if (groupDataStart < skip + take && groupDataEnd > skip) {
          activeGroupKeys.add(row.key);
        }
        
        // Skip to next group
        j = k - 1;
      } else {
        currentDataIndex++;
      }
    }
    
    // Second pass: build result with active group rows and their data rows
    currentDataIndex = 0;
    i = 0;
    
    while (i < data.length && dataRowCount < take) {
      const row = data[i];
      
      if (isGroupRow(row)) {
        // Check if this group is active (has data in page range)
        if (activeGroupKeys.has(row.key)) {
          // Include the group row
          result.push(row);
          i++;
          
          // Include children that fall within the page range
          while (i < data.length && dataRowCount < take) {
            const childRow = data[i];
            
            if (isGroupRow(childRow)) {
              // If it's a group at same or higher level, stop
              if (childRow.level <= row.level) {
                break;
              }
              // Nested group - include if active
              if (activeGroupKeys.has(childRow.key)) {
                result.push(childRow);
                i++;
              } else {
                // Skip nested group and its children
                i++;
                while (i < data.length) {
                  const nextRow = data[i];
                  if (isGroupRow(nextRow) && nextRow.level <= childRow.level) {
                    break;
                  }
                  i++;
                }
              }
            } else {
              // Data row - check if it belongs to this group
              const rowValue = this.getFieldValue(childRow as T, row.field);
              if (String(rowValue) === String(row.value)) {
                // Check if this data row is in the page range
                if (currentDataIndex >= skip && currentDataIndex < skip + take) {
                  result.push(childRow);
                  dataRowCount++;
                }
                currentDataIndex++;
                i++;
              } else {
                // Doesn't belong to this group, stop
                break;
              }
            }
          }
        } else {
          // Group not active, skip it and its children
          i++;
          while (i < data.length) {
            const nextRow = data[i];
            if (isGroupRow(nextRow)) {
              if (nextRow.level <= row.level) {
                break;
              }
            } else {
              // Count data rows we're skipping
              currentDataIndex++;
            }
            i++;
          }
        }
      } else {
        // Data row without parent (shouldn't happen with grouping)
        if (currentDataIndex >= skip && currentDataIndex < skip + take) {
          result.push(row);
          dataRowCount++;
        }
        currentDataIndex++;
        i++;
      }
    }
    
    return result;
  }

  /**
   * Calculate aggregates
   */
  calculateAggregates(data: T[], field: string, aggregate: string): any {
    const values = data.map(row => this.getFieldValue(row, field)).filter(v => v != null);
    
    switch (aggregate) {
      case 'sum':
        return sumBy(values, v => Number(v) || 0);
      case 'avg':
        return meanBy(values, v => Number(v) || 0);
      case 'min':
        return Math.min(...values.map(v => Number(v) || 0));
      case 'max':
        return Math.max(...values.map(v => Number(v) || 0));
      case 'count':
        return values.length;
      default:
        return null;
    }
  }
}


