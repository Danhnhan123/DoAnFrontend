import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TagTypeComponent } from './tag-type.component';

describe('TagTypeComponent', () => {
  let component: TagTypeComponent;
  let fixture: ComponentFixture<TagTypeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TagTypeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TagTypeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
