export interface AuditLogDetailDto {
  id: number;
  tableName: string;
  action: string;
  oldValues?: string;
  newValues?: string;
  changedBy?: string;
  changedDate: string;
}
