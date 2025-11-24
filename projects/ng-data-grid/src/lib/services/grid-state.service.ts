import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { 
  SortConfig, 
  FilterCondition, 
  GroupConfig, 
  PageResult,
  SortDirection 
} from '../types';

/**
 * Service for managing grid state
 */
@Injectable()
export class GridStateService<T = any> {
  private sortSubject$ = new BehaviorSubject<SortConfig[]>([]);
  private filtersSubject$ = new BehaviorSubject<FilterCondition[]>([]);
  private groupsSubject$ = new BehaviorSubject<GroupConfig[]>([]);
  private pageSubject$ = new BehaviorSubject<number>(1);
  private pageSizeSubject$ = new BehaviorSubject<number>(20);
  private selectedRowsSubject$ = new BehaviorSubject<T[]>([]);
  private selectedKeysSubject$ = new BehaviorSubject<any[]>([]);
  private currentRowSubject$ = new BehaviorSubject<T | null>(null);
  private editingRowSubject$ = new BehaviorSubject<T | null>(null);
  private editingCellSubject$ = new BehaviorSubject<{ row: T; field: string } | null>(null);
  private expandedRowsSubject$ = new BehaviorSubject<Set<any>>(new Set());
  private columnOrderSubject$ = new BehaviorSubject<string[]>([]);
  private columnWidthsSubject$ = new BehaviorSubject<Record<string, number>>({});
  private visibleColumnsSubject$ = new BehaviorSubject<Set<string>>(new Set());

  // Public observables
  sort$ = this.sortSubject$.asObservable();
  filters$ = this.filtersSubject$.asObservable();
  groups$ = this.groupsSubject$.asObservable();
  page$ = this.pageSubject$.asObservable();
  pageSize$ = this.pageSizeSubject$.asObservable();
  selectedRows$ = this.selectedRowsSubject$.asObservable();
  selectedKeys$ = this.selectedKeysSubject$.asObservable();
  currentRow$ = this.currentRowSubject$.asObservable();
  editingRow$ = this.editingRowSubject$.asObservable();
  editingCell$ = this.editingCellSubject$.asObservable();
  expandedRows$ = this.expandedRowsSubject$.asObservable();
  columnOrder$ = this.columnOrderSubject$.asObservable();
  columnWidths$ = this.columnWidthsSubject$.asObservable();
  visibleColumns$ = this.visibleColumnsSubject$.asObservable();

  /**
   * Get current sort configuration
   */
  getSort(): SortConfig[] {
    return this.sortSubject$.value;
  }

  /**
   * Set sort configuration
   */
  setSort(sort: SortConfig[]): void {
    this.sortSubject$.next(sort);
  }

  /**
   * Add or update sort for a field
   */
  toggleSort(field: string): void {
    const currentSort = [...this.sortSubject$.value];
    const existingIndex = currentSort.findIndex(s => s.field === field);
    
    if (existingIndex >= 0) {
      const current = currentSort[existingIndex];
      if (current.direction === SortDirection.Asc) {
        current.direction = SortDirection.Desc;
      } else if (current.direction === SortDirection.Desc) {
        currentSort.splice(existingIndex, 1);
      }
    } else {
      currentSort.push({ field, direction: SortDirection.Asc });
    }
    
    this.setSort(currentSort);
  }

  /**
   * Get current filters
   */
  getFilters(): FilterCondition[] {
    return this.filtersSubject$.value;
  }

  /**
   * Set filters
   */
  setFilters(filters: FilterCondition[]): void {
    this.filtersSubject$.next(filters);
  }

  /**
   * Add or update filter
   */
  addFilter(filter: FilterCondition): void {
    const filters = [...this.filtersSubject$.value];
    const existingIndex = filters.findIndex(f => f.field === filter.field);
    
    if (existingIndex >= 0) {
      filters[existingIndex] = filter;
    } else {
      filters.push(filter);
    }
    
    this.setFilters(filters);
  }

  /**
   * Remove filter for a field
   */
  removeFilter(field: string): void {
    const filters = this.filtersSubject$.value.filter(f => f.field !== field);
    this.setFilters(filters);
  }

  /**
   * Get current groups
   */
  getGroups(): GroupConfig[] {
    return this.groupsSubject$.value;
  }

  /**
   * Set groups
   */
  setGroups(groups: GroupConfig[]): void {
    this.groupsSubject$.next(groups);
  }

  /**
   * Get current page
   */
  getPage(): number {
    return this.pageSubject$.value;
  }

  /**
   * Set page
   */
  setPage(page: number): void {
    this.pageSubject$.next(page);
  }

  /**
   * Get current page size
   */
  getPageSize(): number {
    return this.pageSizeSubject$.value;
  }

  /**
   * Set page size
   */
  setPageSize(pageSize: number): void {
    this.pageSizeSubject$.next(pageSize);
    this.setPage(1); // Reset to first page
  }

  /**
   * Get selected rows
   */
  getSelectedRows(): T[] {
    return this.selectedRowsSubject$.value;
  }

  /**
   * Set selected rows
   */
  setSelectedRows(rows: T[]): void {
    this.selectedRowsSubject$.next(rows);
  }

  /**
   * Get selected keys
   */
  getSelectedKeys(): any[] {
    return this.selectedKeysSubject$.value;
  }

  /**
   * Set selected keys
   */
  setSelectedKeys(keys: any[]): void {
    this.selectedKeysSubject$.next(keys);
  }

  /**
   * Get current row
   */
  getCurrentRow(): T | null {
    return this.currentRowSubject$.value;
  }

  /**
   * Set current row
   */
  setCurrentRow(row: T | null): void {
    this.currentRowSubject$.next(row);
  }

  /**
   * Get editing row
   */
  getEditingRow(): T | null {
    return this.editingRowSubject$.value;
  }

  /**
   * Set editing row
   */
  setEditingRow(row: T | null): void {
    this.editingRowSubject$.next(row);
  }

  /**
   * Get editing cell
   */
  getEditingCell(): { row: T; field: string } | null {
    return this.editingCellSubject$.value;
  }

  /**
   * Set editing cell
   */
  setEditingCell(cell: { row: T; field: string } | null): void {
    this.editingCellSubject$.next(cell);
  }

  /**
   * Toggle row expansion
   */
  toggleRowExpansion(key: any): void {
    const expanded = new Set(this.expandedRowsSubject$.value);
    if (expanded.has(key)) {
      expanded.delete(key);
    } else {
      expanded.add(key);
    }
    this.expandedRowsSubject$.next(expanded);
  }

  /**
   * Check if row is expanded
   */
  isRowExpanded(key: any): boolean {
    return this.expandedRowsSubject$.value.has(key);
  }

  /**
   * Get column order
   */
  getColumnOrder(): string[] {
    return this.columnOrderSubject$.value;
  }

  /**
   * Set column order
   */
  setColumnOrder(order: string[]): void {
    this.columnOrderSubject$.next(order);
  }

  /**
   * Get column widths
   */
  getColumnWidths(): Record<string, number> {
    return this.columnWidthsSubject$.value;
  }

  /**
   * Set column width
   */
  setColumnWidth(field: string, width: number): void {
    const widths = { ...this.columnWidthsSubject$.value };
    widths[field] = width;
    this.columnWidthsSubject$.next(widths);
  }

  /**
   * Get visible columns
   */
  getVisibleColumns(): Set<string> {
    return this.visibleColumnsSubject$.value;
  }

  /**
   * Set visible columns
   */
  setVisibleColumns(columns: Set<string>): void {
    this.visibleColumnsSubject$.next(columns);
  }

  /**
   * Toggle column visibility
   */
  toggleColumnVisibility(field: string): void {
    const visible = new Set(this.visibleColumnsSubject$.value);
    if (visible.has(field)) {
      visible.delete(field);
    } else {
      visible.add(field);
    }
    this.setVisibleColumns(visible);
  }

  /**
   * Reset state
   */
  reset(): void {
    this.setSort([]);
    this.setFilters([]);
    this.setGroups([]);
    this.setPage(1);
    this.setSelectedRows([]);
    this.setSelectedKeys([]);
    this.setCurrentRow(null);
    this.setEditingRow(null);
    this.setEditingCell(null);
    this.expandedRowsSubject$.next(new Set());
  }
}

