import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BlogPostStatusComponent } from './blog-post-status.component';

describe('BlogPostStatusComponent', () => {
  let component: BlogPostStatusComponent;
  let fixture: ComponentFixture<BlogPostStatusComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlogPostStatusComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BlogPostStatusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
