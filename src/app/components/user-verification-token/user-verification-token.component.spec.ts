import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserVerificationTokenComponent } from './user-verification-token.component';

describe('UserVerificationTokenComponent', () => {
  let component: UserVerificationTokenComponent;
  let fixture: ComponentFixture<UserVerificationTokenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserVerificationTokenComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserVerificationTokenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
