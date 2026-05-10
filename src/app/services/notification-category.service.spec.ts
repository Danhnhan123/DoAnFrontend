import { TestBed } from '@angular/core/testing';

import { NotificationCategoryService } from './notification-category.service';

describe('NotificationCategoryService', () => {
  let service: NotificationCategoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationCategoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
