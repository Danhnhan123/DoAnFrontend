import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/common';
import { CreateCustomerFeedback, CustomerFeedback, FeedbackPage } from '../models/customer-feedback';

@Injectable({ providedIn: 'root' })
export class CustomerFeedbackService extends ApiService {
  private readonly reportBase = '/customer-feedbacks';

  list(start = 0, length = 100, search = '') {
    let params = new HttpParams().set('start', start).set('length', length).set('draw', 1);
    if (search) params = params.set('search.value', search);
    return this.apiGet<FeedbackPage>(this.reportBase, { params });
  }
  get(id: number) { return this.apiGet<CustomerFeedback>(`${this.reportBase}/${id}`); }
  create(payload: CreateCustomerFeedback) { return this.apiPost<number>(this.reportBase, payload); }
  resolve(id: number, resolutionStatus: string, resolutionNote?: string) {
    return this.apiPut<unknown>(`${this.reportBase}/${id}/resolve`, { resolutionStatus, resolutionNote });
  }
  trace(id: number) { return this.apiGet<unknown>(`${this.reportBase}/${id}/trace-investigation`); }
}
