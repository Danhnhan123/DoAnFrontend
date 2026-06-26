export interface SearchQuery {
  pageIndex?: number;
  pageSize?: number;
  keyword?: string;
  sortType?: string;
  orderBy?: string;
}

export interface DTColumn {
  data: string;
  name: string;
  searchable: boolean;
  orderable: boolean;
  search: { value: string; regex: boolean; fixed: any[] };
}

export interface DTParameters {
  draw: number;
  columns: DTColumn[];
  order: { column: number; dir: string; name: string }[];
  start: number;
  length: number;
  search: { value: string; regex: boolean; fixed: any[] };
}
