import { DTParameters } from './search';

/**
 * Một dòng nhật ký hoạt động (activity log).
 * Trùng cấu trúc ActivityLogAggregate của backend (paged-advanced).
 */
export interface ActivityLogRow {
  id: number;
  action: string;
  description?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdDate: string;
  createdUserId?: number | null;
  createdUserName?: string | null;
}

export interface ActivityLogPagedAdvancedRequest extends DTParameters {
  userId?: number;
}
