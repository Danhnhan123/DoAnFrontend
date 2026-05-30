// API Response wrapper
export interface ApiResponse<T = any> {
  status: number;
  code: string;
  message: string;
  resources: T;
  errors: any;
  isSucceeded: boolean;
}

export interface PagingData<T> {
  items: T[];
  total: number;
  pageIndex: number;
  pageSize: number;
  totalPages: number;
}

export interface DTResponse<T> {
  draw: number;
  recordsTotal: number;
  recordsFiltered: number;
  data: T[];
}

export interface DataItem<T = number> {
  id: T;
  name: string;
}
