import { buildDateRange } from './date.utils';

export interface DataTablesColumn {
  data: string;
  name: string;
  searchable: boolean;
  orderable: boolean;
  search: {
    value: any;
    regex: boolean;
    fixed: any[];
  };
}

export interface DataTablesRequest {
  draw: number;
  columns: DataTablesColumn[];
  order: {
    column: number;
    dir: 'asc' | 'desc';
    name: string;
  }[];
  start: number;
  length: number;
  search: {
    value: string;
    regex: boolean;
    fixed: any[];
  };
  [key: string]: any; // For custom filters
}

export interface PagedParams {
  page: number;
  pageSize: number;
  search?: string;
  sortField?: string;
  sortDir?: 'asc' | 'desc';
  [key: string]: any;
}

/**
 * Utility to build a request body for DataTables-style server-side pagination.
 */
export function buildDataTablesRequest(
  params: PagedParams,
  columns: string[],
  columnFilters: Record<string, any> = {},
  customFilters: Record<string, any> = {}
): DataTablesRequest {
  const sortField = params.sortField || columns[0];
  const sortIndex = Math.max(0, columns.indexOf(sortField));

  const mappedColumns: DataTablesColumn[] = columns.map((name) => {
    const filterValue = columnFilters[name] ?? '';
    return {
      data: name,
      name: name,
      searchable: true,
      orderable: true,
      search: {
        value: filterValue,
        regex: false,
        fixed: [],
      },
    };
  });

  return {
    draw: params.page,
    columns: mappedColumns,
    order: [
      {
        column: sortIndex,
        dir: params.sortDir || 'desc',
        name: sortField,
      },
    ],
    start: (params.page - 1) * params.pageSize,
    length: params.pageSize,
    search: {
      value: (params.search || '').trim(),
      regex: false,
      fixed: [],
    },
    ...customFilters,
  };
}
