import { DTParameters } from './search';

export interface NotificationCategoryRow {
  id: number;
  name: string;
  description?: string | null;
  color: string;
  createdDate: string;
}

export interface NotificationCategoryDetailDto extends NotificationCategoryRow {}

export interface CreateNotificationCategoryDto {
  name: string;
  description?: string | null;
  color: string;
}

export interface UpdateNotificationCategoryDto extends CreateNotificationCategoryDto {
  id: number;
}

export interface NotificationCategoryPagedAdvancedRequest extends DTParameters {}

export interface NotificationCategoryOption {
  id: number;
  name: string;
  color?: string;
}
