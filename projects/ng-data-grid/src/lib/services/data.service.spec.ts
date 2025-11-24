import { TestBed } from '@angular/core/testing';
import { DataService } from './data.service';
import { FilterOperator, SortDirection } from '../types';

describe('DataService', () => {
  let service: DataService<any>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should filter data correctly', (done) => {
    const data = [
      { id: 1, name: 'Product A', price: 100 },
      { id: 2, name: 'Product B', price: 200 }
    ];
    
    service.setDataSource(data);
    
    service.getData({
      filters: [
        { field: 'name', operator: FilterOperator.Contains, value: 'A' }
      ],
      skip: 0,
      take: 10
    }).subscribe(result => {
      expect(result.data.length).toBe(1);
      expect(result.data[0].name).toBe('Product A');
      done();
    });
  });

  it('should sort data correctly', (done) => {
    const data = [
      { id: 2, name: 'B' },
      { id: 1, name: 'A' }
    ];
    
    service.setDataSource(data);
    
    service.getData({
      sort: [
        { field: 'id', direction: SortDirection.Asc }
      ],
      skip: 0,
      take: 10
    }).subscribe(result => {
      expect(result.data[0].id).toBe(1);
      expect(result.data[1].id).toBe(2);
      done();
    });
  });
});


