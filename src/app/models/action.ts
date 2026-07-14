export interface ActionDto {
  id: number;
  code?: string;
  name: string;
  description?: string;
  createdDate: string;
}

export interface ActionAdvancedRow {
  id: number;
  code?: string;
  name: string;
  description?: string;
  createdDate: string;
}

export interface ActionDetailDto {
  id: number;
  code?: string;
  name: string;
  description?: string;
  createdDate: string;
}

export interface CreateActionDto {
  code?: string;
  name: string;
  description?: string;
  createdBy?: number;
}

export interface UpdateActionDto {
  id: number;
  code?: string;
  name: string;
  description?: string;
  createdBy?: number;
  uodatedBy?: number;
}
