import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse, GlobalSearchGroup } from '../models';

/**
 * Dịch vụ tìm kiếm toàn cục cho thanh tìm kiếm trên header.
 * Gọi GET /search?keyword=&limit= — trả về các nhóm kết quả theo loại đối tượng.
 */
@Injectable({ providedIn: 'root' })
export class SearchService extends ApiService {

  globalSearch(
    keyword: string,
    limit = 5
  ): Observable<ApiResponse<GlobalSearchGroup[]>> {
    const params = {
      keyword,
      limit: String(limit),
    };
    return this.apiGet<GlobalSearchGroup[]>(
      '/search',
      params
    );
  }
}
