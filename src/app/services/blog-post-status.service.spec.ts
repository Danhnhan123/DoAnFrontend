import { TestBed } from '@angular/core/testing';

import { BlogPostStatusService } from './blog-post-status.service';

describe('BlogPostStatusService', () => {
  let service: BlogPostStatusService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BlogPostStatusService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
