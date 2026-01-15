import { SortConfig, FilterCondition, GroupConfig } from '../../../../../projects/ng-data-grid/src/public-api';

export type ServerDemoApiEventType =
  | 'productsPage'
  | 'groupMetadata'
  | 'groupChildren'
  | 'nestedGroups'
  | 'export';

export interface ServerDemoApiRequest {
  requestId: string;
  eventType: ServerDemoApiEventType;
  eventData: any;
}

export interface ProductsPageRequest {
  page: number;
  pageSize: number;
  sort?: SortConfig[];
  filters?: FilterCondition[];
  groups?: GroupConfig[];
  search?: string;
}

export interface GroupMetadataRequest {
  groupField: string;
  sort?: SortConfig[];
  filters?: FilterCondition[];
  search?: string;
  skip?: number;
  limit?: number;
}

export interface GroupChildrenRequest {
  groupField: string;
  groupValue: string;
  parentKey?: string; // Add parentKey to request so child can rebuild cache key
  sort?: SortConfig[];
  filters?: FilterCondition[];
  search?: string;
  skip?: number;
  limit?: number;
}

export interface NestedGroupsRequest {
  parentFilters: Array<{ field: string; value: any }>;
  childGroupField: string;
  sort?: SortConfig[];
  filters?: FilterCondition[];
  search?: string;
}

export interface ExportRequest {
  format: 'csv' | 'excel' | 'pdf';
  sort?: SortConfig[];
  filters?: FilterCondition[];
  groups?: GroupConfig[];
  columns?: Array<{ field: string; title?: string }>;
  search?: string;
}

export interface ServerDemoApiResponse {
  requestId: string;
  eventType: ServerDemoApiEventType;
  data: any;
}

