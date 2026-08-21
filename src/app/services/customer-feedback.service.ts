import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../models/common';
import { CreateCustomerFeedback, CustomerFeedback, FeedbackPage } from '../models/customer-feedback';

@Injectable({ providedIn: 'root' })
export class CustomerFeedbackService {
  private http = inject(HttpClient);
  private base = `${environment.baseUrl}/customer-feedbacks`;
  list(start = 0, length = 100, search = '') {
    let params = new HttpParams().set('start', start).set('length', length).set('draw', 1);
    if (search) params = params.set('search.value', search);
    return this.http.get<ApiResponse<FeedbackPage>>(this.base, { params });
  }
  get(id: number) { return this.http.get<ApiResponse<CustomerFeedback>>(`${this.base}/${id}`); }
  create(payload: CreateCustomerFeedback) { return this.http.post<ApiResponse<number>>(this.base, payload); }
  resolve(id: number, resolutionStatus: string, resolutionNote?: string) {
    return this.http.put<ApiResponse<unknown>>(`${this.base}/${id}/resolve`, { resolutionStatus, resolutionNote });
  }
  trace(id: number) { return this.http.get<ApiResponse<unknown>>(`${this.base}/${id}/trace-investigation`); }
}
