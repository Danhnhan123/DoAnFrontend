/**
 * Một dòng mã xác thực người dùng trong màn quản lý (admin) - khớp
 * UserVerificationTokenAggregate của backend (POST /user-verification-token/paged-advanced).
 */
export interface UserVerificationTokenRow {
  id: number;
  code?: string | null;
  /** Mục đích: VERIFY_EMAIL / RESET_PASSWORD / ... (giá trị do backend sinh). */
  purpose?: string | null;
  /** Đã sử dụng hay chưa. */
  isUsed: boolean;
  expirationDate: string;
  createdDate: string;
  userId: number;
  userName?: string | null;
}
