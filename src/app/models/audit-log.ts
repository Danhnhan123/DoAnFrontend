import { DTParameters } from './search';
import { DataItem } from './common';

/**
 * Một dòng nhật ký thay đổi dữ liệu (audit log) trên bảng.
 * Trùng cấu trúc AuditLogAggregate của backend (paged-advanced).
 */
export interface AuditLogRow {
  id: number;
  action: string;
  actionName: string;
  targetType: string;
  targetTypeName: string;
  targetId?: string | null;
  description?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdDate: string;
  createdUserName?: string | null;
  createdUserId?: number | null;
}

/**
 * Chi tiết audit log theo id (GET /audit-log/{id}) - có kèm dữ liệu trước/sau.
 */
export interface AuditLogDetailDto {
  id: number;
  action: string;
  actionName: string;
  targetType: string;
  targetTypeName: string;
  targetId?: string | null;
  dataBefore?: string | null;
  dataAfter?: string | null;
  description?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdDate: string;
  createdUser?: DataItem<number> | null;
}

export interface AuditLogPagedAdvancedRequest extends DTParameters {
  userId?: number;
  roleIds?: number[];
  actions?: string[];
  targetTypes?: string[];
}
