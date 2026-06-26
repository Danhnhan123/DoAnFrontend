export interface ActionDto {
  id: number;
  name: string;
  description?: string;
  createdDate: string;
}

export interface ActionAdvancedRow {
  id: number;
  name: string;
  description?: string;
  createdDate: string;
}

export interface ActionDetailDto {
  id: number;
  name: string;
  description?: string;
  createdDate: string;
}

export interface CreateActionDto {
  name: string;
  description?: string;
  createdBy?: number;
}

export interface UpdateActionDto {
  id: number;
  name: string;
  description?: string;
  createdBy?: number;
  uodatedBy?: number;
}
