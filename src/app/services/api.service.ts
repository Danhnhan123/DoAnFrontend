import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, PagingData, SearchQuery } from '../models';

/**
 * Base service: gom sẵn HttpClient + baseUrl và các helper CRUD.
 * Các service con `extends ApiService` rồi gọi apiGet/apiPost/apiPut/apiDelete
 * để khỏi lặp lại `this.http.<verb>(`${base}...`)`. Tên có tiền tố `api`
 * để không đụng với các method public cùng tên (get/delete/getPaged) mà
 * service con định nghĩa cho component dùng.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  protected http = inject(HttpClient);
  protected base = environment.baseUrl;

  protected apiGet<T>(path: string, options?: object): Observable<ApiResponse<T>> {
    return this.http.get<ApiResponse<T>>(`${this.base}${path}`, options);
  }

  protected apiPost<T>(path: string, body?: any, options?: object): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(`${this.base}${path}`, body, options);
  }

  protected apiPut<T>(path: string, body?: any, options?: object): Observable<ApiResponse<T>> {
    return this.http.put<ApiResponse<T>>(`${this.base}${path}`, body, options);
  }

  protected apiDelete<T>(path: string, options?: object): Observable<ApiResponse<T>> {
    return this.http.delete<ApiResponse<T>>(`${this.base}${path}`, options);
  }

  protected apiGetPaged<T>(path: string, query: SearchQuery): Observable<ApiResponse<PagingData<T>>> {
    return this.http.post<ApiResponse<PagingData<T>>>(`${this.base}${path}`, query);
  }
}
