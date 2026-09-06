import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse, MyNotification, MyNotificationsQuery } from '../models';

@Injectable({ providedIn: 'root' })
export class UserNotificationService extends ApiService {

  /** Thông báo của tôi (BE trả PagingData trong resources: dataSource/total/totalFiltered). */
  getMyNotifications(query: MyNotificationsQuery): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/notification/me', query);
  }

  markRead(userNotificationId: number): Observable<ApiResponse<any>> {
    return this.apiPut<any>(
      `/notification/me/${userNotificationId}/mark-read`,
      {}
    );
  }

  markAllRead(): Observable<ApiResponse<any>> {
    return this.apiPut<any>(
      '/notification/me/mark-all-read',
      {}
    );
  }

  markUnread(userNotificationId: number): Observable<ApiResponse<any>> {
    return this.apiPut<any>(
      `/notification/me/${userNotificationId}/mark-unread`,
      {}
    );
  }

  delete(userNotificationId: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(
      `/notification/me/${userNotificationId}`
    );
  }
}
