import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  SearchQuery,
  PagingData,
  ActivityLogDetailDto,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ActivityLogService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /** Lấy danh sách activity log phân trang */
  getPaged(
    query: SearchQuery
  ): Observable<ApiResponse<PagingData<ActivityLogDetailDto>>> {
    return this.http.post<ApiResponse<PagingData<ActivityLogDetailDto>>>(
      `${this.base}/activity-log/paged`,
      {
        pageIndex: query.pageIndex,
        pageSize: query.pageSize,
        keyword: query.keyword,
        sortType: (query.sortType || 'DESC').toUpperCase(),
        orderBy: query.orderBy || 'createdDate',
      }
    );
  }
}
