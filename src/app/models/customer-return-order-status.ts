export interface CustomerReturnOrderStatusAdvancedRow {
  id: number;
  code?: string;
  name: string;
  color: string;
  createdDate: string;
}

export interface CustomerReturnOrderStatusDetailDto {
  id: number;
  code?: string;
  name: string;
  color: string;
  createdDate: string;
}

export interface CreateCustomerReturnOrderStatusDto {
  code?: string;
  name: string;
  color: string;
}

export interface UpdateCustomerReturnOrderStatusDto extends CreateCustomerReturnOrderStatusDto {
  id: number;
}

export const STANDARD_RETURN_STATUSES: CreateCustomerReturnOrderStatusDto[] = [
  { code: 'DRAFT', name: 'Nháp', color: '#6b7280' },
  { code: 'PENDING_APPROVAL', name: 'Chờ duyệt', color: '#f59e0b' },
  { code: 'APPROVED', name: 'Đã duyệt - chờ nhận hàng', color: '#3b82f6' },
  { code: 'RECEIVED', name: 'Đã nhận - chờ kiểm định', color: '#8b5cf6' },
  { code: 'INSPECTED', name: 'Chờ xác nhận tồn', color: '#06b6d4' },
  { code: 'CONFIRMED', name: 'Đã hoàn tất', color: '#10b981' },
  { code: 'REJECTED', name: 'Đã từ chối', color: '#ef4444' },
  { code: 'CANCELLED', name: 'Đã hủy', color: '#64748b' },
];

