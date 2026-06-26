import { DTParameters } from './search';

export interface NotificationTypeRow {
  id: number;
  name: string;
  description?: string | null;
  createdDate: string;
}

export interface NotificationTypeDetailDto extends NotificationTypeRow {}

export interface CreateNotificationTypeDto {
  name: string;
  description?: string | null;
}

export interface UpdateNotificationTypeDto extends CreateNotificationTypeDto {
  id: number;
}

export interface NotificationTypePagedAdvancedRequest extends DTParameters {}
