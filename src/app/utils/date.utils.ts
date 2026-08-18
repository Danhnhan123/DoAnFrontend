/** Chuyển chuỗi YYYY-MM-DD sang DD/MM/YYYY để gửi filter ngày cho DataTables. */
export function formatToDDMMYYYY(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

/** Xây dựng chuỗi khoảng ngày theo format backend đang parse. */
export function buildDateRange(from: string, to: string): string {
  if (from && to) return `${formatToDDMMYYYY(from)} - ${formatToDDMMYYYY(to)}`;
  if (from) return formatToDDMMYYYY(from);
  if (to) return formatToDDMMYYYY(to);
  return '';
}
