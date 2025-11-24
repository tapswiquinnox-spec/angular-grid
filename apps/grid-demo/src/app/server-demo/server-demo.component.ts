import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import {
  GridOptions,
  ColumnDef,
  ColumnType,
  FilterOperator,
  SortDirection,
  SelectionMode,
  EditMode,
  DataSourceParams,
  PageResult
} from '../../../../../projects/ng-data-grid/src/public-api';

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  rating: number;
  description: string;
  active: boolean;
  createdAt: Date;
}

@Component({
  selector: 'app-server-demo',
  templateUrl: './server-demo.component.html',
  styleUrls: ['./server-demo.component.css']
})
export class ServerDemoComponent implements OnInit {
  @ViewChild('statusTemplate', { static: true }) statusTemplate!: TemplateRef<any>;
  @ViewChild('ratingTemplate', { static: true }) ratingTemplate!: TemplateRef<any>;
  
  // Small dataset for server-side (different data)
  private serverData: Product[] = [];
  
  serverSideOptions!: GridOptions<Product>;
  
  constructor(private http: HttpClient) {
    this.generateServerData();
  }
  
  ngOnInit(): void {
    console.log('🔵 [SERVER-DEMO] Component initialized');
    this.setupServerSideGrid();
  }
  
  /**
   * Generate small server-side dataset (different from client-side)
   */
  private generateServerData(): void {
    console.log('🔵 [SERVER-DEMO] Generating server data...');
    // Different categories for server-side
    const serverCategories = ['Electronics', 'Clothing', 'Books', 'Food & Beverages'];
    const serverProducts = {
      'Electronics': ['Smartphone', 'Laptop', 'Tablet', 'Headphones'],
      'Clothing': ['T-Shirt', 'Jeans', 'Jacket', 'Shoes'],
      'Books': ['Novel', 'Textbook', 'Comic', 'Magazine'],
      'Food & Beverages': ['Coffee', 'Tea', 'Chocolate', 'Juice']
    };
    
    const serverBrands = ['Premium', 'Classic', 'Pro', 'Elite'];
    
    // Generate only 50 items for server-side (much less than client-side)
    for (let i = 1; i <= 50; i++) {
      const category = serverCategories[i % serverCategories.length];
      const categoryProducts = serverProducts[category as keyof typeof serverProducts] || serverProducts['Electronics'];
      const productName = categoryProducts[i % categoryProducts.length];
      const brand = serverBrands[i % serverBrands.length];
      const basePrice = this.getBasePrice(category);
      const price = basePrice * (0.7 + Math.random() * 0.6); // ±30% variation
      
      this.serverData.push({
        id: i,
        name: `${brand} ${productName} #${i}`,
        category: category,
        price: Math.round(price * 100) / 100,
        stock: Math.floor(Math.random() * 1000) + 100, // 100-1100 stock
        rating: Math.round((3 + Math.random() * 2) * 10) / 10, // 3.0 to 5.0
        description: `Server-side ${productName.toLowerCase()} from ${brand} brand.`,
        active: Math.random() > 0.2, // 80% active
        createdAt: new Date(2023 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1)
      });
    }
    console.log('🔵 [SERVER-DEMO] Generated', this.serverData.length, 'items');
  }
  
  /**
   * Get base price for category
   */
  private getBasePrice(category: string): number {
    const priceMap: { [key: string]: number } = {
      'Electronics': 299.99,
      'Clothing': 49.99,
      'Food & Beverages': 9.99,
      'Books': 19.99,
      'Toys & Games': 24.99,
      'Home & Garden': 79.99,
      'Sports & Outdoors': 89.99,
      'Health & Beauty': 14.99
    };
    return priceMap[category] || 29.99;
  }
  
  /**
   * Setup server-side grid
   */
  private setupServerSideGrid(): void {
    console.log('🔵 [SERVER-DEMO] Setting up server-side grid');
    this.serverSideOptions = {
      columns: [
        {
          field: 'id',
          title: 'ID',
          type: ColumnType.Number,
          width: 80,
          sortable: true,
          filterable: true,
          resizable: true
        },
        {
          field: 'name',
          title: 'Product Name',
          type: ColumnType.String,
          width: 200,
          sortable: true,
          filterable: true,
          editable: true,
          resizable: true
        },
        {
          field: 'category',
          title: 'Category',
          type: ColumnType.String,
          width: 150,
          sortable: true,
          filterable: true,
          resizable: true
        },
        {
          field: 'price',
          title: 'Price',
          type: ColumnType.Number,
          width: 120,
          sortable: true,
          filterable: true,
          editable: true,
          resizable: true,
          align: 'right',
          valueFormatter: (value: any) => `$${value.toFixed(2)}`
        },
        {
          field: 'stock',
          title: 'Stock',
          type: ColumnType.Number,
          width: 100,
          sortable: true,
          filterable: true,
          editable: true,
          resizable: true,
          align: 'right'
        },
        {
          field: 'rating',
          title: 'Rating',
          type: ColumnType.Number,
          width: 150,
          sortable: true,
          filterable: true,
          resizable: true,
          cellTemplate: this.ratingTemplate
        },
        {
          field: 'active',
          title: 'Status',
          type: ColumnType.Boolean,
          width: 100,
          sortable: true,
          filterable: true,
          resizable: true,
          cellTemplate: this.statusTemplate
        }
      ],
      dataSource: (params: DataSourceParams) => this.getServerData(params),
      pageSizeOptions: [10, 20, 50, 100],
      defaultPageSize: 20,
      editable: true,
      editMode: EditMode.Cell,
      selectionMode: SelectionMode.Multiple,
      rowKey: 'id',
      virtualScroll: false,
      columnReorder: true,
      columnResize: true,
      persistSettings: true,
      settingsKey: 'server-side-grid',
      showHeader: true,
      showFooter: true,
      showRowNumbers: true,
      enableExport: true,
      exportFormats: ['csv', 'excel', 'pdf'],
      keyboardNavigation: true,
      rowHeight: 40,
      headerHeight: 40
    };
    console.log('🔵 [SERVER-DEMO] Server-side grid configured');
  }
  
  /**
   * Get server-side data (simulated) - uses different, smaller dataset
   * COMMENTED OUT FOR DEBUGGING - Only logger active
   */
  private getServerData(params: DataSourceParams): Observable<PageResult<Product>> {
    // LOGGER: Check if server-side is being called
    console.log('🔵 [SERVER-SIDE] getServerData CALLED!', {
      timestamp: new Date().toISOString(),
      params: {
        page: params.page,
        pageSize: params.pageSize,
        skip: params.skip,
        take: params.take,
        sort: params.sort,
        filters: params.filters,
        groups: params.groups,
        infiniteScroll: params.infiniteScroll
      },
      serverDataLength: this.serverData.length
    });
    
    // Simulate server delay
    return of(null).pipe(
      delay(300),
      map(() => {
        console.log('🔵 [SERVER-SIDE] Processing server data...');
        
        // COMMENTED OUT: All functionality disabled for debugging
        // Use serverData instead of allData (different, smaller dataset)
        // let data = [...this.serverData];
        
        // COMMENTED OUT: Filtering
        // if (params.filters && params.filters.length > 0) {
        //   data = data.filter(row => {
        //     return params.filters!.every((filter: any) => {
        //       const value = this.getFieldValue(row, filter.field);
        //       switch (filter.operator) {
        //         case FilterOperator.Contains:
        //           return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
        //         case FilterOperator.GreaterThan:
        //           return Number(value) > Number(filter.value);
        //         case FilterOperator.LessThan:
        //           return Number(value) < Number(filter.value);
        //         default:
        //           return true;
        //       }
        //     });
        //   });
        // }
        
        // COMMENTED OUT: Sorting
        // if (params.sort && params.sort.length > 0) {
        //   data.sort((a, b) => {
        //     for (const sort of params.sort!) {
        //       const aVal = this.getFieldValue(a, sort.field);
        //       const bVal = this.getFieldValue(b, sort.field);
        //       let comparison = 0;
        //       
        //       if (aVal > bVal) comparison = 1;
        //       else if (aVal < bVal) comparison = -1;
        //       
        //       if (sort.direction === SortDirection.Desc) comparison *= -1;
        //       if (comparison !== 0) return comparison;
        //     }
        //     return 0;
        //   });
        // }
        
        // COMMENTED OUT: Pagination
        // const total = data.length;
        // const skip = params.skip || 0;
        // const take = params.take || 20;
        // const pageData = data.slice(skip, skip + take);
        
        // Return minimal data for testing
        const total = this.serverData.length;
        const skip = params.skip || 0;
        const take = params.take || 20;
        const pageData = this.serverData.slice(skip, skip + take);
        
        console.log('🔵 [SERVER-SIDE] Returning data', {
          dataCount: pageData.length,
          total: total,
          skip: skip,
          take: take,
          page: params.page,
          pageSize: params.pageSize
        });
        
        return {
          data: pageData,
          total,
          page: params.page,
          pageSize: params.pageSize
        };
      })
    );
  }
  
  /**
   * Get field value
   */
  private getFieldValue(obj: any, field: string): any {
    return field.split('.').reduce((o, p) => o?.[p], obj);
  }
  
  /**
   * Event handlers
   */
  onRowClick(event: any): void {
    console.log('Row clicked:', event);
  }
  
  onCellClick(event: any): void {
    console.log('Cell clicked:', event);
  }
  
  onSelectionChange(event: any): void {
    console.log('Selection changed:', event);
  }
  
  onSortChange(event: any): void {
    console.log('Sort changed:', event);
  }
  
  onFilterChange(event: any): void {
    console.log('Filter changed:', event);
  }
  
  onPageChange(event: any): void {
    console.log('Page changed:', event);
  }
  
  onEditSave(event: any): void {
    console.log('Edit saved:', event);
  }
  
  /**
   * Get stars string for rating
   */
  getStars(rating: number): string {
    const filled = Math.floor(rating);
    const empty = 5 - filled;
    return '★'.repeat(filled) + '☆'.repeat(empty);
  }
}

