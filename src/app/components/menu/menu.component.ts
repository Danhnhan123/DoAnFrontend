import { Component, signal, inject, computed, effect } from '@angular/core';
import { PermissionService } from '../../services/permission.service';
import { ReadonlyIfDirective } from '../../directives/readonly-if.directive';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import {
  injectQuery,
  injectMutation,
  injectQueryClient,
} from '@tanstack/angular-query-experimental';
import Swal from 'sweetalert2';
import {
  MenuAggregate,
  MenuDetailDto,
  CreateMenuDto,
  UpdateMenuDto,
  ActionDto,
} from '../../models';
import { MenuService } from '../../services/menu.service';
import { ActionService } from '../../services/action.service';

import { FilterSelectComponent } from '../shared/filter-select.component';
import { HasPermissionDirective } from '../../directives/has-permission.directive';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [ReadonlyIfDirective, HasPermissionDirective, CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css',
})
export class MenuComponent {
  perm = inject(PermissionService);
  viewOnly = computed(() => this.isEdit() && !this.perm.canUpdate('MENU_LIST'));
  private menuService = inject(MenuService);
  private actionService = inject(ActionService);
  private queryClient = injectQueryClient();

  showModal = signal(false);
  editItem = signal<MenuAggregate | null>(null);
  isEdit = computed(() => !!this.editItem());
  isReadOnly = signal(false);

  form = signal<{
    code: string;
    name: string;
    url: string;
    icon: string;
    className: string;
    sortOrder: number;
    parentId: number | null;
    menuType: string;
    isAdminOnly: boolean;
    actionIds: number[];
  }>({
    code: '',
    name: '',
    url: '',
    icon: '',
    className: '',
    sortOrder: 1,
    parentId: null,
    menuType: 'ADMIN',
    isAdminOnly: false,
    actionIds: [],
  });

  menuTypes = ['ADMIN', 'CLIENT', 'BOTH'];

  // ── Queries ──────────────────────────────────────────────────────────────

  menusQuery = injectQuery(() => ({
    queryKey: ['menus'],
    queryFn: () => lastValueFrom(this.menuService.getAll()),
  }));

  actionsQuery = injectQuery(() => ({
    queryKey: ['menu-action-options'],
    queryFn: () => lastValueFrom(this.actionService.getAll()),
    staleTime: 5 * 60_000,
  }));

  detailQuery = injectQuery(() => ({
    queryKey: ['menu-detail', this.editItem()?.id],
    enabled: !!this.editItem()?.id && this.showModal(),
    queryFn: () =>
      lastValueFrom(this.menuService.getById(this.editItem()!.id)),
  }));

  flatMenus = computed<MenuAggregate[]>(() => {
    const res = this.menusQuery.data() as any;
    return res?.resources || res?.data || [];
  });
  nestedMenus = computed<MenuAggregate[]>(() =>
    this.menuService.buildMenuTree(this.flatMenus())
  );
  totalRecords = computed(() => this.flatMenus().length);
  loading = computed(() => this.menusQuery.isPending());
  loadingDetail = computed(() => this.detailQuery.isFetching());

  allActions = computed<ActionDto[]>(() => {
    const res = this.actionsQuery.data() as any;
    return res?.resources || res?.data || [];
  });

  /**
   * Đổ dữ liệu chi tiết (từ API get-by-id) vào form khi mở modal sửa/xem.
   * Dùng effect để tự chạy lại mỗi khi detailQuery có dữ liệu mới.
   * (Trước đây dùng getter _detailSynced nhưng không được template gọi nên
   *  isAdminOnly và actionIds không bao giờ được map.)
   */
  private syncDetail = effect(() => {
    const d = this.detailQuery.data();

    if (!d || !this.showModal() || !this.isEdit()) return;

    const detail: MenuDetailDto = (d as any)?.resources ?? (d as any)?.data;
    if (!detail) return;

    this.form.set({
      code: detail.code || '',
      name: detail.name,
      url: detail.url || '',
      icon: detail.icon || '',
      className: detail.className || '',
      sortOrder: detail.sortOrder,
      parentId: detail.parentId ?? null,
      menuType: detail.menuType,
      isAdminOnly: detail.isAdminOnly,
      actionIds: detail.actionIds || [],
    });
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  createMutation = injectMutation(() => ({
    mutationFn: (payload: CreateMenuDto) =>
      lastValueFrom(this.menuService.create(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['menus'] });
        // Cấu trúc menu thay đổi -> làm mới sidebar theo quyền.
        this.queryClient.invalidateQueries({ queryKey: ['sidebar-menus'] });
        this.showAlert('Thêm menu thành công!');
      } else this.showAlert(res.message || 'Thất bại', false);
    },
    onError: (err: any) => this.showAlert(err?.error?.message || 'Lỗi hệ thống', false),
  }));

  updateMutation = injectMutation(() => ({
    mutationFn: (payload: UpdateMenuDto) =>
      lastValueFrom(this.menuService.update(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['menus'] });
        // Cấu trúc menu thay đổi -> làm mới sidebar theo quyền.
        this.queryClient.invalidateQueries({ queryKey: ['sidebar-menus'] });
        this.showAlert('Cập nhật menu thành công!');
      } else this.showAlert(res.message || 'Thất bại', false);
    },
    onError: (err: any) => this.showAlert(err?.error?.message || 'Lỗi hệ thống', false),
  }));

  deleteMutation = injectMutation(() => ({
    mutationFn: (id: number) =>
      lastValueFrom(this.menuService.delete(id)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.queryClient.invalidateQueries({ queryKey: ['menus'] });
        // Cấu trúc menu thay đổi -> làm mới sidebar theo quyền.
        this.queryClient.invalidateQueries({ queryKey: ['sidebar-menus'] });
        this.showAlert('Đã xóa menu thành công!');
      } else this.showAlert(res.message || 'Xóa thất bại', false);
    },
    onError: (err: any) => this.showAlert(err?.error?.message || 'Lỗi hệ thống', false),
  }));

  saving = computed(
    () => this.createMutation.isPending() || this.updateMutation.isPending()
  );

  // ── UI Helpers ────────────────────────────────────────────────────────────

  getRootMenus(): MenuAggregate[] {
    return (this.nestedMenus() || [])
      .filter((m) => !m.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }
  getChildren(m: MenuAggregate): MenuAggregate[] {
    return (m.child || []).sort((a, b) => a.sortOrder - b.sortOrder);
  }
  hasChildren(m: MenuAggregate): boolean {
    return !!m.child?.length;
  }

  /** Icon dạng font-class (vd "fa fa-truck"); rỗng nếu là emoji/ký tự. */
  iconClass(icon?: string | null): string {
    const val = (icon || '').trim();
    if (!val) return '';
    const isFontClass =
      val.includes(' ') || /^(fa|fas|far|fab|bi|glyphicon)-/.test(val);
    return isFontClass ? val : '';
  }

  renderParentOptions(
    items: MenuAggregate[],
    depth = 0
  ): { id: number; label: string; disabled: boolean }[] {
    const result: any[] = [];
    const self = this.editItem();
    for (const m of items.sort((a, b) => a.sortOrder - b.sortOrder)) {
      if (self && m.id === self.id) continue;
      result.push({ id: m.id, label: '— '.repeat(depth) + m.name, disabled: false });
      if (m.child?.length)
        result.push(...this.renderParentOptions(m.child, depth + 1));
    }
    return result;
  }

  /** Options danh mục cha cho dropdown chung (bỏ mục bị khóa). */
  parentSelectOptions = computed(() =>
    this.renderParentOptions(this.nestedMenus())
      .filter((o) => !o.disabled)
      .map((o) => ({ id: o.id, name: o.label }))
  );

  /** Options loại menu cho dropdown chung. */
  get menuTypeOptions() {
    return this.menuTypes.map((t) => ({ id: t, name: t }));
  }

  openCreate(): void {
    this.editItem.set(null);
    this.isReadOnly.set(false);
    this.form.set({
      code: '', name: '', url: '', icon: '', className: '', sortOrder: 1,
      parentId: null, menuType: 'ADMIN', isAdminOnly: false, actionIds: [],
    });
    this.showModal.set(true);
  }
  openEdit(menu: MenuAggregate, readOnly = false): void {
    this.editItem.set(menu);
    this.isReadOnly.set(readOnly);
    this.form.set({
      code: menu.code || '', name: menu.name, url: menu.url || '', icon: menu.icon || '',
      className: '', sortOrder: menu.sortOrder, parentId: menu.parentId ?? null,
      menuType: menu.menuType, isAdminOnly: false, actionIds: [],
    });
    this.showModal.set(true);
  }
  closeModal(): void {
    this.showModal.set(false);
    this.editItem.set(null);
  }
  setField(f: string, v: any): void {
    this.form.update((x) => ({ ...x, [f]: v }));
  }
  toggleAction(id: number, checked: boolean): void {
    this.form.update((x) => ({
      ...x,
      actionIds: checked ? [...x.actionIds, id] : x.actionIds.filter((a) => a !== id),
    }));
  }
  isActionSelected(id: number): boolean {
    return this.form().actionIds.includes(id);
  }

  save(): void {
    const f = this.form();
    if (!f.name) { this.showAlert('Vui lòng nhập tên menu', false); return; }
    const actionText = this.isEdit() ? 'cập nhật' : 'thêm mới';
    Swal.fire({
      title: `Xác nhận ${actionText}`,
      text: `Bạn có chắc chắn muốn ${actionText} menu này?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#15803d',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
    }).then((result) => {
      if (!result.isConfirmed) return;
      if (this.isEdit()) {
        this.updateMutation.mutate({
          id: this.editItem()!.id,
          code: f.code || null,
          name: f.name,
          url: f.url || '',
          icon: f.icon || '',
          className: f.className || null,
          sortOrder: Number(f.sortOrder) || 1,
          parentId: f.parentId || null,
          menuType: f.menuType,
          isAdminOnly: f.isAdminOnly,
          actionIds: f.actionIds,
        } as UpdateMenuDto);
      } else {
        this.createMutation.mutate({
          code: f.code || null,
          name: f.name,
          url: f.url || '',
          icon: f.icon || '',
          className: f.className || null,
          sortOrder: Number(f.sortOrder) || 1,
          parentId: f.parentId || null,
          menuType: f.menuType,
          isAdminOnly: f.isAdminOnly,
          actionIds: f.actionIds,
        } as CreateMenuDto);
      }
    });
  }

  delete(id: number, name: string): void {
    Swal.fire({
      title: 'Bạn có chắc chắn?',
      text: `Bạn chuẩn bị xóa menu "${name}". Thao tác này không thể hoàn tác!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Có, Xóa!',
      cancelButtonText: 'Hủy',
    }).then((result) => {
      if (result.isConfirmed) this.deleteMutation.mutate(id);
    });
  }

  private showAlert(msg: string, ok = true): void {
    Swal.fire({
      title: ok ? 'Thành công!' : 'Thất bại!',
      text: msg,
      icon: ok ? 'success' : 'error',
      confirmButtonColor: '#15803d',
      confirmButtonText: 'Đóng',
      showClass: { popup: 'animate__animated animate__fadeInDown animate__faster' },
      hideClass: { popup: 'animate__animated animate__fadeOutUp animate__faster' },
    });
  }
}
