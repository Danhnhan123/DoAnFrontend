import { TestBed } from '@angular/core/testing';

import { UserVerificationTokenService } from './user-verification-token.service';

describe('UserVerificationTokenService', () => {
  let service: UserVerificationTokenService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserVerificationTokenService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
