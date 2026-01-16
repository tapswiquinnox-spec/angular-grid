# Angular Data Grid

A production-ready, feature-rich Angular data grid component library built with Angular 17+ and TypeScript. This component provides all the functionality of commercial grid libraries while being framework-native and lightweight.

## Features

### Column Features
- ✅ Dynamic columns defined via config (title, field, type, sortable, filterable, editable, width, resizable, pinned/frozen left/right, visible)
- ✅ Column reorder via drag & drop
- ✅ Column resize by drag
- ✅ Column templates (custom cell renderer) and header templates

### Data Features
- ✅ Client-side and server-side (remote) data modes
- ✅ Pagination (page sizes, server-side paging)
- ✅ Virtual scrolling/row virtualization for very large datasets (100k+ rows)
- ✅ Lazy loading with request cancellation when new params arrive
- ✅ Sorting (multi-column sorts) client & server
- ✅ Filtering (text, numeric, date, select, custom) client & server with filter UI
- ✅ Grouping rows by one or more columns with expandable/collapsible groups
- ✅ Aggregates (sum, avg, min, max, count) per group and footer aggregates

### Editing
- ✅ Row edit, cell edit, inline & popup editing
- ✅ Add / Delete rows with optimistic UI and server-sync capability
- ✅ Validation (built on Angular Forms) and error display

### Selection
- ✅ Single, multiple, and range selection (shift+click)
- ✅ Select-all checkbox in header (with indeterminate state)

### UI & UX
- ✅ Fixed/frozen columns and horizontal scroll
- ✅ Row and column virtualization performance tuned for ~100k rows
- ✅ Row drag & drop to reorder rows (client-side)
- ✅ Keyboard navigation (arrow keys, Enter to edit, Esc to cancel)
- ✅ Accessibility (ARIA roles, labels, focus management)
- ✅ RTL support and responsive behavior (mobile-friendly)
- ✅ Theming with CSS variables + Tailwind-compatible classnames (allow light/dark)

### Extras
- ✅ Export to CSV / Excel / PDF (client-side)
- ✅ Column chooser (show/hide columns)
- ✅ Persist user settings (column order, widths, filters, sorts) via localStorage and optional server persistence
- ✅ Row detail panel (expand row to show more info)
- ✅ Frozen header while scrolling
- ✅ Row virtualization with sticky group headers

## Installation

```bash
npm install
```

## Development

### Build the library

```bash
npm run build
```

### Run the demo app

```bash
npm start
```

Navigate to `http://localhost:4200/`

### Run tests

```bash
npm test
```

### Run E2E tests

```bash
npm run e2e
```

## Quick Start

### 1. Import the Module

```typescript
import { NgModule } from '@angular/core';
import { NgDataGridModule } from '@ng-data-grid/core';

@NgModule({
  imports: [
    NgDataGridModule
  ]
})
export class AppModule { }
```

### 2. Define Your Data and Columns

```typescript
import { Component } from '@angular/core';
import { GridOptions, ColumnDef, ColumnType, SortDirection } from '@ng-data-grid/core';

interface DataItem {
  id: number;
  name: string;
  price: number;
  stock: number;
}

@Component({
  selector: 'app-my-grid',
  template: `
    <lib-data-grid [options]="gridOptions"></lib-data-grid>
  `
})
export class MyGridComponent {
  data: DataItem[] = [
    { id: 1, name: 'Item A', price: 100, stock: 50 },
    { id: 2, name: 'Item B', price: 200, stock: 30 }
  ];

  gridOptions: GridOptions<DataItem> = {
    columns: [
      {
        field: 'id',
        title: 'ID',
        type: ColumnType.Number,
        width: 80,
        sortable: true
      },
      {
        field: 'name',
        title: 'Item Name',
        type: ColumnType.String,
        width: 200,
        sortable: true,
        filterable: true,
        editable: true
      },
      {
        field: 'price',
        title: 'Price',
        type: ColumnType.Number,
        width: 120,
        sortable: true,
        align: 'right',
        valueFormatter: (value) => `$${value.toFixed(2)}`
      }
    ],
    dataSource: this.data,
    pageSizeOptions: [10, 20, 50],
    defaultPageSize: 20,
    selectionMode: SelectionMode.Multiple,
    editable: true,
    virtualScroll: true
  };
}
```

## API Reference

### GridOptions<T>

Main configuration interface for the grid.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `columns` | `ColumnDef<T>[]` | Required | Column definitions |
| `dataSource` | `DataSource<T>` | Required | Data source (array, Observable, or function) |
| `pageSizeOptions` | `number[]` | `[10, 20, 50, 100]` | Available page sizes |
| `defaultPageSize` | `number` | `20` | Default page size |
| `defaultSort` | `SortConfig[]` | `[]` | Default sort configuration |
| `defaultFilters` | `FilterCondition[]` | `[]` | Default filter conditions |
| `editable` | `boolean` | `false` | Whether grid is editable |
| `editMode` | `EditMode` | `EditMode.Cell` | Edit mode |
| `selectionMode` | `SelectionMode` | `SelectionMode.None` | Selection mode |
| `rowKey` | `string \| ((row: T) => any)` | - | Unique row key field or function |
| `rowHeight` | `number` | `40` | Row height in pixels |
| `headerHeight` | `number` | `40` | Header height in pixels |
| `virtualScroll` | `boolean` | `false` | Enable virtualization |
| `virtualScrollBuffer` | `number` | `5` | Virtual scroll buffer size |
| `columnReorder` | `boolean` | `true` | Enable column reordering |
| `columnResize` | `true` | `true` | Enable column resizing |
| `persistSettings` | `boolean` | `false` | Persist settings to localStorage |
| `settingsKey` | `string` | - | Key for settings persistence |
| `rtl` | `boolean` | `false` | Enable RTL mode |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'light'` | Theme |

### ColumnDef<T>

Column definition interface.

| Property | Type | Description |
|----------|------|-------------|
| `field` | `string` | Field name (supports dot notation) |
| `title` | `string` | Display title |
| `type` | `ColumnType` | Column data type |
| `width` | `number` | Column width in pixels |
| `minWidth` | `number` | Minimum column width |
| `maxWidth` | `number` | Maximum column width |
| `sortable` | `boolean` | Whether column is sortable |
| `filterable` | `boolean` | Whether column is filterable |
| `editable` | `boolean` | Whether column is editable |
| `resizable` | `boolean` | Whether column is resizable |
| `visible` | `boolean` | Whether column is visible |
| `pinned` | `'left' \| 'right' \| false` | Pin column to left or right |
| `align` | `'left' \| 'center' \| 'right'` | Column alignment |
| `cellTemplate` | `TemplateRef<any>` | Custom cell template |
| `headerTemplate` | `TemplateRef<any>` | Custom header template |
| `valueFormatter` | `(value: any, row: T, column: ColumnDef<T>) => string` | Value formatter function |
| `valueParser` | `(value: string, row: T, column: ColumnDef<T>) => any` | Value parser for editing |

### DataSource<T>

Data source can be:
- `T[]` - Static array
- `Observable<PageResult<T>>` - Observable of page result
- `(params: DataSourceParams) => Observable<PageResult<T>>` - Function returning observable

### Server-Side Integration

For server-side data, provide a function that accepts `DataSourceParams` and returns an `Observable<PageResult<T>>`:

```typescript
gridOptions: GridOptions<Product> = {
  // ... columns
  dataSource: (params: DataSourceParams) => {
    // Build query params
    const httpParams = new HttpParams()
      .set('page', params.page?.toString() || '1')
      .set('pageSize', params.pageSize?.toString() || '20')
      .set('sort', JSON.stringify(params.sort))
      .set('filters', JSON.stringify(params.filters));
    
    return this.http.get<PageResult<DataItem>>('/api/data', { params: httpParams });
  }
};
```

**Expected Server Response:**

```typescript
interface PageResult<T> {
  data: T[];
  total: number;
  page?: number;
  pageSize?: number;
}
```

## Examples

### Basic Grid with Client-Side Data

```typescript
gridOptions: GridOptions<Product> = {
  columns: [
    { field: 'id', title: 'ID', type: ColumnType.Number },
    { field: 'name', title: 'Name', type: ColumnType.String },
    { field: 'price', title: 'Price', type: ColumnType.Number }
  ],
  dataSource: this.data,
  pageSizeOptions: [10, 20, 50],
  defaultPageSize: 20
};
```

### Server-Side Paging + Sorting + Filtering

```typescript
gridOptions: GridOptions<Product> = {
  columns: [
    { field: 'id', title: 'ID', type: ColumnType.Number, sortable: true, filterable: true },
    { field: 'name', title: 'Name', type: ColumnType.String, sortable: true, filterable: true },
    { field: 'price', title: 'Price', type: ColumnType.Number, sortable: true, filterable: true }
  ],
  dataSource: (params) => this.dataService.getData(params),
  pageSizeOptions: [10, 20, 50],
  defaultPageSize: 20
};
```

### Custom Cell Templates

```typescript
@Component({
  template: `
    <lib-data-grid [options]="gridOptions">
      <ng-template #statusTemplate let-row let-value="value">
        <span [class]="value ? 'badge-success' : 'badge-danger'">
          {{ value ? 'Active' : 'Inactive' }}
        </span>
      </ng-template>
    </lib-data-grid>
  `
})
export class MyComponent {
  @ViewChild('statusTemplate') statusTemplate!: TemplateRef<any>;
  
  gridOptions: GridOptions<DataItem> = {
    columns: [
      {
        field: 'active',
        title: 'Status',
        cellTemplate: this.statusTemplate
      }
    ],
    dataSource: this.products
  };
}
```

### Editing and Validation

```typescript
gridOptions: GridOptions<Product> = {
  columns: [
    {
      field: 'name',
      title: 'Name',
      editable: true,
      valueParser: (value) => {
        if (!value || value.trim().length === 0) {
          throw new Error('Name is required');
        }
        return value.trim();
      }
    },
    {
      field: 'price',
      title: 'Price',
      editable: true,
      valueParser: (value) => {
        const num = parseFloat(value);
        if (isNaN(num) || num < 0) {
          throw new Error('Price must be a positive number');
        }
        return num;
      }
    }
  ],
  dataSource: this.data,
  editable: true,
  editMode: EditMode.Cell
};
```

## Events

The grid emits the following events:

- `rowClick` - Fired when a row is clicked
- `cellClick` - Fired when a cell is clicked
- `rowDoubleClick` - Fired when a row is double-clicked
- `cellDoubleClick` - Fired when a cell is double-clicked
- `selectionChange` - Fired when selection changes
- `sortChange` - Fired when sort changes
- `filterChange` - Fired when filters change
- `pageChange` - Fired when page changes
- `editStart` - Fired when editing starts
- `editSave` - Fired when edit is saved
- `editCancel` - Fired when edit is cancelled
- `dataStateChange` - Fired when data state changes
- `columnReorder` - Fired when column is reordered
- `columnResize` - Fired when column is resized

## Theming

The grid uses CSS variables for theming. You can customize colors:

```css
.ng-data-grid {
  --grid-bg-color: #fff;
  --grid-text-color: #333;
  --grid-border-color: #ddd;
  --grid-header-bg-color: #f5f5f5;
  --grid-primary-color: #007bff;
  /* ... more variables */
}
```

Or use the built-in themes:

```typescript
gridOptions: GridOptions<Product> = {
  // ...
  theme: 'dark' // or 'light' or 'auto'
};
```

## Accessibility

The grid includes full ARIA support:
- `role="grid"` on the main container
- `role="row"` on rows
- `role="gridcell"` on cells
- `aria-selected` for selected rows
- `aria-sort` for sorted columns
- Keyboard navigation support

## Performance

- Uses `OnPush` change detection strategy
- Implements virtual scrolling for large datasets
- Uses `trackBy` functions for efficient rendering
- Debounces user-driven operations
- Cancels previous HTTP requests when new ones arrive

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines.

## Architecture Decisions

### Virtualization Technique

The grid uses a simple but effective virtualization approach:
- Calculates visible rows based on scroll position
- Renders only visible rows plus a buffer
- Uses spacers to maintain scroll position
- Updates on scroll events

### Server-Side Contract

The server-side data source expects:
- Query parameters: `page`, `pageSize`, `sort`, `filters`, `groups`
- Response format: `{ data: T[], total: number, page?: number, pageSize?: number }`
- Uses RxJS `switchMap` to cancel previous requests

### Event Flow

Events flow through:
1. User interaction → Component method
2. Component method → State service update
3. State service → Observable emission
4. Observable → Data service query
5. Data service → Component update
6. Component → Event emitter → Parent component


