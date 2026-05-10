import { TestBed } from '@angular/core/testing';

import { NotificationTypeService } from './notification-type.service';

describe('NotificationTypeService', () => {
  let service: NotificationTypeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationTypeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
