import { Component, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  AngularDataGridWidgetApiRequest,
  AngularDataGridWidgetApiResponse,
  DataPageRequest,
  GroupMetadataRequest,
  GroupChildrenRequest,
  NestedGroupsRequest,
  ExportRequest
} from './angular-data-grid-widget.types';

/**
 * Parent component that ONLY handles API calls.
 * All grid logic, state, and UI is handled by angular-data-grid-view child component.
 */
@Component({
  selector: 'app-angular-data-grid-widget',
  templateUrl: './angular-data-grid-widget.component.html',
  styleUrls: ['./angular-data-grid-widget.component.css']
})
export class AngularDataGridWidgetComponent implements OnInit {
  
  @ViewChild('angularDataGridWidget', { static: false }) angularDataGridWidget!: any; // Reference to angular-data-grid-view component
  
  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}
  
  ngOnInit(): void {
    // Component is ready, child will request initial data
  }

  /**
   * Single event entrypoint from child.
   * Parent performs API calls only and pushes results back on apiResponses$.
   */
  onApiRequest(req: AngularDataGridWidgetApiRequest): void {
    switch (req.eventType) {
      case 'dataPage': {
        const r = req.eventData as DataPageRequest;
        this.fetchMockApiPage(r.page, r.pageSize, r.sort || [], r.filters || [], r.groups || [], r.search || '').subscribe({
          next: (result) => this.angularDataGridWidget?.onApiResponse({ requestId: req.requestId, eventType: 'dataPage', data: result }),
          error: (err) => this.angularDataGridWidget?.onApiResponse({ requestId: req.requestId, eventType: 'dataPage', data: { data: [], total: 0, error: String(err) } })
        });
        return;
      }
      case 'groupMetadata': {
        const r = req.eventData as GroupMetadataRequest;
        this.fetchGroupMetadataAPI(r.groupField, r.sort || [], r.filters || [], r.skip || 0, r.limit || 10, r.search || '').subscribe({
          next: (response) => this.angularDataGridWidget?.onApiResponse({ requestId: req.requestId, eventType: 'groupMetadata', data: { request: r, response } }),
          error: (err) => this.angularDataGridWidget?.onApiResponse({ requestId: req.requestId, eventType: 'groupMetadata', data: { request: r, response: { groups: [], total: 0 }, error: String(err) } })
        });
        return;
      }
      case 'groupChildren': {
        const r = req.eventData as GroupChildrenRequest;
        const skip = r.skip || 0;
        const limit = r.limit || 10;
        this.fetchGroupChildrenAPI(r.groupField, r.groupValue, r.sort || [], r.filters || [], r.search || '', skip, limit).subscribe({
          next: (response) => {
            const children = response.content || [];
            const total = response.total || 0;
            const page = Math.floor(skip / limit) + 1;
            const hasMore = skip + limit < total;
            // Return request data so child can build the correct cache key
            this.angularDataGridWidget?.onApiResponse({
              requestId: req.requestId,
              eventType: 'groupChildren',
              data: { request: r, children, total, hasMore, page, pageSize: limit }
            });
          },
          error: (err) => this.angularDataGridWidget?.onApiResponse({ requestId: req.requestId, eventType: 'groupChildren', data: { error: String(err) } })
        });
        return;
      }
      case 'nestedGroups': {
        const r = req.eventData as NestedGroupsRequest;
        let url = `http://localhost:3000/api/data/nested-groups`;
        const query: string[] = [];
        query.push(`parentFilters=${encodeURIComponent(JSON.stringify(r.parentFilters || []))}`);
        query.push(`childGroupField=${encodeURIComponent(r.childGroupField)}`);
        if (r.sort?.length) query.push(`sortBy=${encodeURIComponent(JSON.stringify(r.sort))}`);
        if (r.filters?.length) query.push(`filters=${encodeURIComponent(JSON.stringify(r.filters))}`);
        if (r.search?.trim()) query.push(`search=${encodeURIComponent(r.search.trim())}`);
        url += `?${query.join('&')}`;

        this.http.get<any>(url).subscribe({
          next: (response) => {
            // Use cacheKey from request if provided, otherwise generate a fallback
            const cacheKey = r.cacheKey || `nested-${r.childGroupField}-parents${JSON.stringify(r.parentFilters || [])}`;
            this.angularDataGridWidget?.onApiResponse({
              requestId: req.requestId,
              eventType: 'nestedGroups',
              data: { cacheKey, metadata: response.groups || [], total: response.total || 0 }
            });
          },
          error: (err) => this.angularDataGridWidget?.onApiResponse({ requestId: req.requestId, eventType: 'nestedGroups', data: { error: String(err) } })
        });
        return;
      }
      case 'export': {
        const r = req.eventData as ExportRequest;
        this.fetchExportFile(r).subscribe({
          next: ({ blob, filename }) => {
            this.downloadBlob(blob, filename);
          },
          error: (err) => {
            console.error('Export failed', err);
          }
        });
        return;
      }
    }
  }

  // -------------------------
  // API Methods (ONLY API calls, no logic)
  // -------------------------
  private fetchMockApiPage(
    page: number, 
    pageSize: number, 
    sort: any[] = [], 
    filters: any[] = [], 
    groups: any[] = [],
    search?: string
  ): Observable<{ data: any[]; total: number }> {
    const skip = (page - 1) * pageSize;
    let url = `http://localhost:3000/api/data`;
    url += `?skip=${skip}`;
    url += `&limit=${pageSize}`;
    
    if (sort && sort.length > 0) {
      url += `&sortBy=${encodeURIComponent(JSON.stringify(sort))}`;
    }
    
    if (filters && filters.length > 0) {
      url += `&filters=${encodeURIComponent(JSON.stringify(filters))}`;
    }
    
    if (search && search.trim()) {
      url += `&search=${encodeURIComponent(search.trim())}`;
    }
    
    return this.http.get<any>(url).pipe(
      map(resp => {
        const data = resp.content || [];
        const total = resp.total || 0;
        return { data, total };
      })
    );
  }

  private fetchGroupMetadataAPI(
    groupField: string,
    sort: any[] = [],
    filters: any[] = [],
    skip: number = 0,
    limit: number = 10,
    search: string = ''
  ): Observable<{ groups: Array<{ value: any; key: string; count: number }>; total: number; skip: number; limit: number }> {
    let url = `http://localhost:3000/api/data/groups`;
    url += `?groupField=${encodeURIComponent(groupField)}`;
    url += `&skip=${skip}`;
    url += `&limit=${limit}`;
    
    if (sort && sort.length > 0) {
      url += `&sortBy=${encodeURIComponent(JSON.stringify(sort))}`;
    }
    
    if (filters && filters.length > 0) {
      url += `&filters=${encodeURIComponent(JSON.stringify(filters))}`;
    }
    
    if (search && search.trim()) {
      url += `&search=${encodeURIComponent(search.trim())}`;
    }
    
    return this.http.get<any>(url).pipe(
      map(resp => {
        const metadata = resp.groups || [];
        const total = resp.total || 0;
        return {
          groups: metadata,
          total: total,
          skip: resp.skip || skip,
          limit: resp.limit || limit
        };
      })
    );
  }

  private fetchGroupChildrenAPI(
    groupField: string,
    groupValue: string,
    sort: any[] = [],
    filters: any[] = [],
    search: string = '',
    skip: number = 0,
    limit: number = 10
  ): Observable<{ content: any[]; total: number; skip: number; limit: number }> {
    let url = `http://localhost:3000/api/data/children`;
    url += `?groupField=${encodeURIComponent(groupField)}`;
    url += `&groupValue=${encodeURIComponent(groupValue === '(null)' ? '' : String(groupValue))}`;
    url += `&skip=${skip}`;
    url += `&limit=${limit}`;
    
    if (sort && sort.length > 0) {
      url += `&sortBy=${encodeURIComponent(JSON.stringify(sort))}`;
    }
    
    const nonGroupFilters = filters.filter((f: any) => !(f.field === groupField && f.operator === 'equals'));
    if (nonGroupFilters.length > 0) {
      url += `&filters=${encodeURIComponent(JSON.stringify(nonGroupFilters))}`;
    }
    
    if (search && search.trim()) {
      url += `&search=${encodeURIComponent(search.trim())}`;
    }
    
    return this.http.get<any>(url).pipe(
      map(resp => {
        const content = resp.content || [];
        return {
          content: content,
          total: resp.total || content.length,
          skip: resp.skip || skip,
          limit: resp.limit || limit
        };
      })
    );
  }

  private fetchExportFile(request: ExportRequest): Observable<{ blob: Blob; filename: string }> {
    const url = `http://localhost:3000/api/data/export`;
    return this.http.post(url, request, { observe: 'response', responseType: 'blob' }).pipe(
      map((response) => {
        const contentDisposition = response.headers.get('content-disposition') || '';
        const match = /filename="?([^"]+)"?/i.exec(contentDisposition);
        const extension = request.format === 'excel' ? 'xlsx' : request.format;
        const fallbackName = `export-${Date.now()}.${extension}`;
        return {
          blob: response.body as Blob,
          filename: match?.[1] || fallbackName
        };
      })
    );
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }
}
