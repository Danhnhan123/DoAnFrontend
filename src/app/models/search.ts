export interface SearchQuery {
  pageIndex?: number;
  pageSize?: number;
  keyword?: string;
  sortType?: string;
  orderBy?: string;
}

// ── Tìm kiếm toàn cục (thanh tìm kiếm trên header) ─────────────────────────
export interface GlobalSearchItem {
  id: number;
  title: string;
  subtitle?: string | null;
}

export interface GlobalSearchGroup {
  type: string; // PRODUCT | PRODUCT_VARIANT | PADDY_LOT | SALES_ORDER | INBOUND_ORDER | CUSTOMER | FARMER | SUPPLIER
  label: string; // nhãn tiếng Việt
  url: string; // đường dẫn màn danh sách (FE điều hướng kèm ?q=)
  items: GlobalSearchItem[];
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
