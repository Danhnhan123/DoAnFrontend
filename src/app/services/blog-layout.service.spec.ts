import { TestBed } from '@angular/core/testing';

import { BlogLayoutService } from './blog-layout.service';

describe('BlogLayoutService', () => {
  let service: BlogLayoutService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BlogLayoutService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
