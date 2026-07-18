import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, MyNotification, MyNotificationsQuery } from '../models';

@Injectable({ providedIn: 'root' })
export class UserNotificationService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /** Thông báo của tôi (BE trả PagingData trong resources: dataSource/total/totalFiltered). */
  getMyNotifications(query: MyNotificationsQuery): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.base}/notification/me`, query);
  }

  markRead(userNotificationId: number): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.base}/notification/me/${userNotificationId}/mark-read`,
      {}
    );
  }

  markUnread(userNotificationId: number): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.base}/notification/me/${userNotificationId}/mark-unread`,
      {}
    );
  }

  delete(userNotificationId: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(
      `${this.base}/notification/me/${userNotificationId}`
    );
  }
}
