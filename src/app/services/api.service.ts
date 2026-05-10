import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, PagingData, SearchQuery } from '../models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  protected base = environment.baseUrl;

  constructor(protected http: HttpClient) {}

  get<T>(path: string, params?: any): Observable<ApiResponse<T>> {
    return this.http.get<ApiResponse<T>>(`${this.base}${path}`, { params });
  }

  post<T>(path: string, body: any): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(`${this.base}${path}`, body);
  }

  put<T>(path: string, body: any): Observable<ApiResponse<T>> {
    return this.http.put<ApiResponse<T>>(`${this.base}${path}`, body);
  }

  delete<T>(path: string): Observable<ApiResponse<T>> {
    return this.http.delete<ApiResponse<T>>(`${this.base}${path}`);
  }

  getPaged<T>(path: string, query: SearchQuery): Observable<ApiResponse<PagingData<T>>> {
    return this.http.post<ApiResponse<PagingData<T>>>(`${this.base}${path}`, query);
  }
}