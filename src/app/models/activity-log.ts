export interface ActivityLogDetailDto {
  id: number;
  userId: number;
  userName: string;
  action: string;
  description?: string;
  ipAddress?: string;
  createdDate: string;
}
