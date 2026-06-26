import { DTParameters } from './search';
import { DataItem } from './common';

export interface NotificationRow {
  id: number;
  notificationCategoryId: number;
  notificationCategoryName: string;
  notificationCategoryColor: string;
  directionId?: string | null;
  title: string;
  content: string;
  createdDate: string;
}

export interface NotificationDetailDto {
  id: number;
  notificationCategoryId: number;
  directionId?: string | null;
  title: string;
  content: string;
  createdDate: string;
  notificationCategory: DataItem<number>;
  notificationUsers: DataItem<number>[];
}

export interface CreateNotificationDto {
  notificationCategoryId: number;
  directionId?: string | null;
  title: string;
  content: string;
  userIds: number[];
}

export interface UpdateNotificationDto extends CreateNotificationDto {
  id: number;
}

export interface NotificationPagedAdvancedRequest extends DTParameters {
  notificationCategoryIds?: number[];
  isAdmin?: boolean;
  userId?: number;
}

export interface UserOption {
  id: number;
  name: string;
}
