import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, GlobalSearchGroup } from '../models';

/**
 * Dịch vụ tìm kiếm toàn cục cho thanh tìm kiếm trên header.
 * Gọi GET /search?keyword=&limit= — trả về các nhóm kết quả theo loại đối tượng.
 */
@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  globalSearch(
    keyword: string,
    limit = 5
  ): Observable<ApiResponse<GlobalSearchGroup[]>> {
    const params = new HttpParams()
      .set('keyword', keyword)
      .set('limit', String(limit));
    return this.http.get<ApiResponse<GlobalSearchGroup[]>>(
      `${this.base}/search`,
      { params }
    );
  }
}
