import { Component, signal, inject, computed } from '@angular/core';
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

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css',
})
export class MenuComponent {
  private menuService = inject(MenuService);
  private actionService = inject(ActionService);
  private queryClient = injectQueryClient();

  showModal = signal(false);
  editItem = signal<MenuAggregate | null>(null);
  isEdit = computed(() => !!this.editItem());
  isReadOnly = signal(false);

  form = signal<{
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
  toast = signal<{ msg: string; ok: boolean } | null>(null);

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

  private _prevDetailData: any = null;
  get _detailSynced(): boolean {
    const d = this.detailQuery.data();
    if (d && d !== this._prevDetailData) {
      this._prevDetailData = d;
      const detail: MenuDetailDto = (d as any)?.resources ?? (d as any)?.data;
      if (detail)
        this.form.set({
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
    }
    return true;
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  createMutation = injectMutation(() => ({
    mutationFn: (payload: CreateMenuDto) =>
      lastValueFrom(this.menuService.create(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['menus'] });
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

  openCreate(): void {
    this._prevDetailData = null;
    this.editItem.set(null);
    this.isReadOnly.set(false);
    this.form.set({
      name: '', url: '', icon: '', className: '', sortOrder: 1,
      parentId: null, menuType: 'ADMIN', isAdminOnly: false, actionIds: [],
    });
    this.showModal.set(true);
  }
  openEdit(menu: MenuAggregate, readOnly = false): void {
    this._prevDetailData = null;
    this.editItem.set(menu);
    this.isReadOnly.set(readOnly);
    this.form.set({
      name: menu.name, url: menu.url || '', icon: menu.icon || '',
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
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
    }).then((result) => {
      if (!result.isConfirmed) return;
      if (this.isEdit()) {
        this.updateMutation.mutate({
          id: this.editItem()!.id,
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
      confirmButtonColor: '#4f46e5',
      confirmButtonText: 'Đóng',
      showClass: { popup: 'animate__animated animate__fadeInDown animate__faster' },
      hideClass: { popup: 'animate__animated animate__fadeOutUp animate__faster' },
    });
  }
}
