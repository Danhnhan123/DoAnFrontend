import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentTransactionComponent } from './payment-transaction.component';

describe('PaymentTransactionComponent', () => {
  let component: PaymentTransactionComponent;
  let fixture: ComponentFixture<PaymentTransactionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaymentTransactionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PaymentTransactionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
