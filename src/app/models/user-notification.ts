/** Một thông báo của người dùng đang đăng nhập (GET/POST /notification/me). */
export interface MyNotification {
  /** userNotificationId (dùng để mark-read/unread/delete). */
  id: number;
  notificationId: number;
  title: string;
  content: string;
  /** Đường dẫn nội bộ để điều hướng khi bấm vào thông báo. */
  directionId?: string | null;
  notificationCategoryId: number;
  notificationCategoryName: string;
  isRead: boolean;
  createdDate?: string;
  modifiedDate?: string;
}

/** Query lấy thông báo của tôi (khớp UserNotificationsSearchQuery ở BE). */
export interface MyNotificationsQuery {
  pageIndex: number;
  pageSize: number;
  keyword?: string;
  orderBy?: string;
  sortType?: 'asc' | 'desc';
  isRead?: boolean | null;
}
