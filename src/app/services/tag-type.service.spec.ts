import { TestBed } from '@angular/core/testing';

import { TagTypeService } from './tag-type.service';

describe('TagTypeService', () => {
  let service: TagTypeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TagTypeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
