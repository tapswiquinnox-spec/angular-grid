import { Injectable } from '@angular/core';
import { GridStateService } from './grid-state.service';
import { ColumnDef } from '../types';

/**
 * Service for persisting grid settings
 */
@Injectable()
export class PersistenceService {
  private readonly STORAGE_PREFIX = 'ng-data-grid-';

  /**
   * Save grid settings to localStorage
   */
  saveSettings(key: string, settings: GridSettings): void {
    try {
      const storageKey = `${this.STORAGE_PREFIX}${key}`;
      localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save grid settings:', error);
    }
  }

  /**
   * Load grid settings from localStorage
   */
  loadSettings(key: string): GridSettings | null {
    try {
      const storageKey = `${this.STORAGE_PREFIX}${key}`;
      const data = localStorage.getItem(storageKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn('Failed to load grid settings:', error);
      return null;
    }
  }

  /**
   * Clear grid settings
   */
  clearSettings(key: string): void {
    try {
      const storageKey = `${this.STORAGE_PREFIX}${key}`;
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Failed to clear grid settings:', error);
    }
  }

  /**
   * Apply settings to grid state
   */
  applySettings(state: GridStateService, settings: GridSettings): void {
    if (settings.columnOrder) {
      state.setColumnOrder(settings.columnOrder);
    }
    if (settings.columnWidths) {
      Object.entries(settings.columnWidths).forEach(([field, width]) => {
        state.setColumnWidth(field, width);
      });
    }
    if (settings.visibleColumns) {
      state.setVisibleColumns(new Set(settings.visibleColumns));
    }
    if (settings.sort) {
      state.setSort(settings.sort);
    }
    // Filters are NOT persisted to localStorage - they should be reset on page load
    // if (settings.filters) {
    //   state.setFilters(settings.filters);
    // }
    if (settings.pageSize) {
      state.setPageSize(settings.pageSize);
    }
  }

  /**
   * Extract settings from grid state
   */
  extractSettings(state: GridStateService): GridSettings {
    const currentFilters = state.getFilters();
    if (currentFilters.length > 0) {
      console.log('[PERSISTENCE] Filters are NOT persisted to localStorage. Current filters will be excluded:', currentFilters);
    }
    return {
      columnOrder: state.getColumnOrder(),
      columnWidths: state.getColumnWidths(),
      visibleColumns: Array.from(state.getVisibleColumns()),
      sort: state.getSort(),
      // Filters are NOT persisted to localStorage - they should be reset on page load
      // filters: state.getFilters(),
      pageSize: state.getPageSize()
    };
  }
}

/**
 * Grid settings interface
 */
export interface GridSettings {
  columnOrder?: string[];
  columnWidths?: Record<string, number>;
  visibleColumns?: string[];
  sort?: any[];
  filters?: any[];
  pageSize?: number;
}


