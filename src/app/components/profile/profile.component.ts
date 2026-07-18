import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom, Subscription } from 'rxjs';
import { injectQuery, injectQueryClient } from '@tanstack/angular-query-experimental';
import Swal from 'sweetalert2';
import { Router, ActivatedRoute } from '@angular/router';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { UserDeviceService } from '../../services/user-device.service';
import { DevicePresenceService } from '../../services/device-presence.service';
import { UserNotificationService } from '../../services/user-notification.service';
import { FcmService } from '../../services/fcm.service';
import { FilterSelectComponent } from '../shared/filter-select.component';
import {
  FileUploadItem,
  FolderNode,
  UpdateUserProfileDto,
  UserProfileDto,
  MyDevice,
  MyNotification,
} from '../../models';
import { getOrCreateDeviceId } from '../../utils/device.util';

type ProfileTab = 'info' | 'password' | 'devices' | 'notifications';

/**
 * Trang "Tài khoản của tôi" cho web admin.
 * - Tab 1: thông tin cá nhân (avatar + form cập nhật) -> PUT /user/me.
 * - Tab 2: đổi mật khẩu -> PUT /user/me/change-password.
 * Sau khi lưu, đồng bộ lại tên/avatar hiển thị trên topbar & sidebar.
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit, OnDestroy {
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private userDeviceService = inject(UserDeviceService);
  private devicePresenceService = inject(DevicePresenceService);
  private notiService = inject(UserNotificationService);
  private fcm = inject(FcmService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // ------- Tab thiết bị -------
  private queryClient = injectQueryClient();
  readonly currentDeviceId = getOrCreateDeviceId();
  private presenceSub?: Subscription;
  private fcmSub?: Subscription;
  private routeSub?: Subscription;

  // ------- Trạng thái chung -------
  activeTab = signal<ProfileTab>('info');
  loading = signal(true);

  // ------- Tab thông báo của tôi (realtime TanStack Query) -------
  notiPage = signal(1);
  readonly notiPageSize = 20;
  notiQuery = injectQuery(() => ({
    queryKey: ['profile-notifications', this.notiPage()],
    enabled: this.activeTab() === 'notifications',
    queryFn: () =>
      lastValueFrom(
        this.notiService.getMyNotifications({
          pageIndex: this.notiPage(),
          pageSize: this.notiPageSize,
          isRead: null,
        })
      ),
  }));
  private notiPaging = computed<any>(() => {
    const r: any = this.notiQuery.data();
    return r?.resources ?? r?.data ?? null;
  });
  myNotifications = computed<MyNotification[]>(() => {
    const p = this.notiPaging();
    return p?.dataSource ?? p?.items ?? [];
  });
  notiTotal = computed<number>(() => {
    const p = this.notiPaging();
    return p?.totalFiltered ?? p?.total ?? 0;
  });
  notiTotalPages = computed<number>(() => Math.max(1, Math.ceil(this.notiTotal() / this.notiPageSize)));
  notiLoading = computed(() => this.notiQuery.isPending());

  // Dùng TanStack Query giống các màn danh sách khác: realtime chỉ cần invalidate ->
  // tự refetch ở nền và render lại tối thiểu (không hiện lại spinner cả bảng).
  deviceListQuery = injectQuery(() => ({
    queryKey: ['my-devices'],
    enabled: this.activeTab() === 'devices',
    queryFn: () => lastValueFrom(this.userDeviceService.getMyDevices()),
  }));
  devices = computed<MyDevice[]>(() => {
    const res: any = this.deviceListQuery.data();
    return res?.resources ?? res?.data ?? [];
  });
  /** Chỉ hiện spinner ở lần tải đầu (chưa có dữ liệu); refetch realtime thì im lặng. */
  devicesLoading = computed(() => this.deviceListQuery.isPending());
  profile = signal<UserProfileDto | null>(null);

  /** Đồng bộ với genderOptions của màn Quản lý người dùng (Nam=1, Nữ=0). */
  readonly genderOptions = [
    { id: 1, name: 'Nam' },
    { id: 0, name: 'Nữ' },
  ];

  // ------- Tab thông tin -------
  firstName = signal('');
  lastName = signal('');
  gender = signal<number | null>(null);
  phoneNumber = signal('');
  addresDetail = signal('');
  avatarId = signal<number | null>(null);
  avatarUrl = signal<string | null>(null);
  savingInfo = signal(false);

  // ------- Trình quản lý ảnh (popup) -------
  pickerOpen = signal(false);

  // Thư mục
  folders = signal<FolderNode[]>([]);
  foldersLoading = signal(false);
  selectedFolderId = signal<number | null>(null);
  creatingFolder = signal(false);
  newFolderName = signal('');
  savingFolder = signal(false);

  // Ảnh trong thư mục (phân trang)
  images = signal<FileUploadItem[]>([]);
  imagesLoading = signal(false);
  page = signal(1);
  readonly pageSize = 18;
  totalImages = signal(0);
  uploading = signal(false);

  // Ảnh đang chọn trong popup (chỉ áp dụng khi bấm "Chọn ảnh này")
  pickedImageId = signal<number | null>(null);
  pickedImageUrl = signal<string | null>(null);

  /** Cây thư mục làm phẳng kèm độ sâu để hiển thị dạng danh sách thụt lề. */
  flatFolders = computed(() => {
    const out: { id: number; name: string; depth: number }[] = [];
    const walk = (nodes: FolderNode[], depth: number): void => {
      for (const n of nodes) {
        out.push({ id: n.id, name: n.folderName, depth });
        if (n.childs?.length) walk(n.childs, depth + 1);
      }
    };
    walk(this.folders(), 0);
    return out;
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalImages() / this.pageSize))
  );

  // ------- Tab đổi mật khẩu -------
  oldPassword = signal('');
  newPassword = signal('');
  confirmNewPassword = signal('');
  showOld = signal(false);
  showNew = signal(false);
  showConfirm = signal(false);
  changingPassword = signal(false);

  // Chữ cái viết tắt khi chưa có ảnh đại diện
  initials = computed(() => {
    const f = this.firstName().trim();
    const l = this.lastName().trim();
    const text = `${f} ${l}`.trim() || this.profile()?.username || 'U';
    return text
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  });

  // ---- Kiểm tra độ mạnh mật khẩu mới (khớp quy tắc backend) ----
  pwHasLower = computed(() => /[a-z]/.test(this.newPassword()));
  pwHasUpper = computed(() => /[A-Z]/.test(this.newPassword()));
  pwHasDigit = computed(() => /\d/.test(this.newPassword()));
  pwHasSpecial = computed(() =>
    /[!@#$%^&*(),.?":{}|<>]/.test(this.newPassword())
  );
  pwHasMinLen = computed(() => this.newPassword().length >= 10);
  pwMatch = computed(
    () =>
      this.confirmNewPassword().length > 0 &&
      this.newPassword() === this.confirmNewPassword()
  );
  passwordValid = computed(
    () =>
      this.pwHasLower() &&
      this.pwHasUpper() &&
      this.pwHasDigit() &&
      this.pwHasSpecial() &&
      this.pwHasMinLen()
  );

  ngOnInit(): void {
    this.loadProfile();

    // Cho phép mở đúng tab qua query param (vd nút "Xem tất cả" -> /admin/profile?tab=notifications).
    // Dùng subscription để đổi tab được cả khi đang ở sẵn trang Profile.
    this.routeSub = this.route.queryParamMap.subscribe(params => {
      const tab = params.get('tab');
      if (tab === 'notifications' || tab === 'devices' || tab === 'password' || tab === 'info') {
        this.activeTab.set(tab);
      }
    });

    // Realtime: server báo thiết bị đổi -> chỉ invalidate query, TanStack tự refetch nền
    // và render lại phần thay đổi (giống các màn danh sách khác), không load lại cả bảng.
    this.presenceSub = this.devicePresenceService.devicesChanged$.subscribe(() => {
      this.queryClient.invalidateQueries({ queryKey: ['my-devices'] });
    });

    // Realtime thông báo: có push (foreground) -> làm mới tab thông báo + badge chuông.
    this.fcmSub = this.fcm.messageReceived$.subscribe(() => this.invalidateNotifications());
  }

  ngOnDestroy(): void {
    this.presenceSub?.unsubscribe();
    this.fcmSub?.unsubscribe();
    this.routeSub?.unsubscribe();
  }

  // ------- Tab thông báo của tôi -------
  private invalidateNotifications(): void {
    this.queryClient.invalidateQueries({ queryKey: ['profile-notifications'] });
    this.queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
    this.queryClient.invalidateQueries({ queryKey: ['my-notifications-unread'] });
  }

  notiSetPage(p: number): void {
    if (p < 1 || p > this.notiTotalPages()) return;
    this.notiPage.set(p);
  }

  async onNotiClick(n: MyNotification): Promise<void> {
    if (!n.isRead) {
      try {
        await lastValueFrom(this.notiService.markRead(n.id));
      } catch {
        /* ignore */
      }
      this.invalidateNotifications();
    }
    if (n.directionId) {
      this.router.navigateByUrl(n.directionId);
    }
  }

  async toggleNotiRead(n: MyNotification, event: Event): Promise<void> {
    event.stopPropagation();
    try {
      if (n.isRead) await lastValueFrom(this.notiService.markUnread(n.id));
      else await lastValueFrom(this.notiService.markRead(n.id));
      this.invalidateNotifications();
    } catch {
      /* ignore */
    }
  }

  // Trạng thái realtime -> nhãn + màu.
  statusLabel(status?: string): string {
    if (status === 'active') return 'Đang hoạt động';
    if (status === 'idle') return 'Đang chờ';
    return 'Không hoạt động';
  }
  statusClass(status?: string): string {
    if (status === 'active') return 'st-active';
    if (status === 'idle') return 'st-idle';
    return 'st-offline';
  }

  private async loadProfile(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await lastValueFrom(this.userService.getMyProfile());
      if (res.isSucceeded && res.resources) {
        const p = res.resources;
        this.profile.set(p);
        this.firstName.set(p.firstName ?? '');
        this.lastName.set(p.lastName ?? '');
        this.gender.set(p.gender ?? null);
        this.phoneNumber.set(p.phoneNumber ?? '');
        this.addresDetail.set(p.addresDetail ?? '');
        this.avatarId.set(p.avatar?.id ?? null);
        this.avatarUrl.set(p.avatar?.url ?? null);
      } else {
        Swal.fire('Lỗi', res.message || 'Không tải được hồ sơ.', 'error');
      }
    } catch {
      Swal.fire('Lỗi', 'Không tải được hồ sơ. Vui lòng thử lại.', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  setTab(tab: ProfileTab): void {
    // Query 'my-devices' tự bật khi activeTab='devices' (enabled) và tự fetch lần đầu.
    this.activeTab.set(tab);
  }

  // ------- Tab thiết bị -------
  isCurrentDevice(d: MyDevice): boolean {
    return !!d.deviceId && d.deviceId === this.currentDeviceId;
  }

  async logoutDevice(d: MyDevice): Promise<void> {
    if (!d.deviceId) return;
    const isCurrent = this.isCurrentDevice(d);
    const confirm = await Swal.fire({
      title: 'Đăng xuất thiết bị?',
      text: isCurrent
        ? 'Đây là thiết bị hiện tại, đăng xuất sẽ kết thúc phiên của bạn.'
        : `Đăng xuất khỏi "${d.deviceName || 'thiết bị này'}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Đăng xuất',
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Hủy',
    });
    if (!confirm.isConfirmed) return;

    // Đăng xuất chính thiết bị hiện tại -> dùng luồng logout chung (đã tự xoá đăng ký thiết bị).
    if (isCurrent) {
      this.devicePresenceService.stop();
      this.authService.logout().subscribe({ next: () => {}, error: () => {} });
      return;
    }

    try {
      const res: any = await lastValueFrom(this.userDeviceService.logoutDevice(d.deviceId));
      if (res?.isSucceeded) {
        // Chỉ invalidate -> query tự refetch nền và render lại (realtime cũng sẽ bắn thêm).
        this.queryClient.invalidateQueries({ queryKey: ['my-devices'] });
        Swal.fire('Thành công', 'Đã đăng xuất thiết bị.', 'success');
      } else {
        Swal.fire('Lỗi', res?.message || 'Đăng xuất thất bại.', 'error');
      }
    } catch {
      Swal.fire('Lỗi', 'Đăng xuất thất bại. Vui lòng thử lại.', 'error');
    }
  }

  async logoutOtherDevices(): Promise<void> {
    const confirm = await Swal.fire({
      title: 'Đăng xuất tất cả thiết bị khác?',
      text: 'Các thiết bị khác (trừ thiết bị hiện tại) sẽ bị đăng xuất.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Đăng xuất tất cả',
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Hủy',
    });
    if (!confirm.isConfirmed) return;

    try {
      const res: any = await lastValueFrom(
        this.userDeviceService.logoutOtherDevices(this.currentDeviceId)
      );
      if (res?.isSucceeded) {
        this.queryClient.invalidateQueries({ queryKey: ['my-devices'] });
        Swal.fire('Thành công', 'Đã đăng xuất các thiết bị khác.', 'success');
      } else {
        Swal.fire('Lỗi', res?.message || 'Thao tác thất bại.', 'error');
      }
    } catch {
      Swal.fire('Lỗi', 'Thao tác thất bại. Vui lòng thử lại.', 'error');
    }
  }

  // ------- Trình quản lý ảnh -------
  openPicker(): void {
    this.pickedImageId.set(this.avatarId());
    this.pickedImageUrl.set(this.avatarUrl());
    this.creatingFolder.set(false);
    this.newFolderName.set('');
    this.pickerOpen.set(true);
    this.loadFolders();
  }

  closePicker(): void {
    this.pickerOpen.set(false);
    this.creatingFolder.set(false);
  }

  private async loadFolders(): Promise<void> {
    this.foldersLoading.set(true);
    try {
      const res = await lastValueFrom(this.userService.getFolders());
      const list = res.isSucceeded ? res.resources ?? [] : [];
      this.folders.set(list);
      // Nếu thư mục đang chọn không còn -> reset danh sách ảnh.
      const stillThere = this.flatFolders().some(
        (f) => f.id === this.selectedFolderId()
      );
      if (!stillThere) {
        this.selectedFolderId.set(null);
        this.images.set([]);
        this.totalImages.set(0);
      }
    } catch {
      this.folders.set([]);
      Swal.fire('Lỗi', 'Không tải được danh sách thư mục.', 'error');
    } finally {
      this.foldersLoading.set(false);
    }
  }

  selectFolder(id: number): void {
    if (this.selectedFolderId() === id) return;
    this.selectedFolderId.set(id);
    this.page.set(1);
    this.loadImages();
  }

  startCreateFolder(): void {
    this.creatingFolder.set(true);
    this.newFolderName.set('');
  }

  cancelCreateFolder(): void {
    this.creatingFolder.set(false);
    this.newFolderName.set('');
  }

  /** Tạo thư mục con trong thư mục đang chọn (hoặc thư mục gốc nếu chưa chọn). */
  async submitCreateFolder(): Promise<void> {
    const name = this.newFolderName().trim();
    if (!name) {
      Swal.fire('Thiếu tên', 'Vui lòng nhập tên thư mục.', 'warning');
      return;
    }
    this.savingFolder.set(true);
    try {
      const res = await lastValueFrom(
        this.userService.createFolder(name, this.selectedFolderId())
      );
      if (res.isSucceeded) {
        const newId = res.resources;
        this.creatingFolder.set(false);
        this.newFolderName.set('');
        await this.loadFolders();
        if (typeof newId === 'number') this.selectFolder(newId);
      } else {
        Swal.fire('Lỗi', res.message || 'Tạo thư mục thất bại.', 'error');
      }
    } catch {
      Swal.fire('Lỗi', 'Tạo thư mục thất bại. Vui lòng thử lại.', 'error');
    } finally {
      this.savingFolder.set(false);
    }
  }

  private async loadImages(): Promise<void> {
    const folderId = this.selectedFolderId();
    if (folderId == null) {
      this.images.set([]);
      this.totalImages.set(0);
      return;
    }
    this.imagesLoading.set(true);
    try {
      const res = await lastValueFrom(
        this.userService.getFolderImages(folderId, this.page(), this.pageSize)
      );
      if (res.isSucceeded && res.resources) {
        this.images.set(res.resources.dataSource ?? []);
        this.totalImages.set(
          res.resources.totalFiltered ?? res.resources.total ?? 0
        );
      } else {
        this.images.set([]);
        this.totalImages.set(0);
      }
    } catch {
      this.images.set([]);
      this.totalImages.set(0);
      Swal.fire('Lỗi', 'Không tải được ảnh trong thư mục.', 'error');
    } finally {
      this.imagesLoading.set(false);
    }
  }

  prevPage(): void {
    if (this.page() <= 1) return;
    this.page.update((p) => p - 1);
    this.loadImages();
  }

  nextPage(): void {
    if (this.page() >= this.totalPages()) return;
    this.page.update((p) => p + 1);
    this.loadImages();
  }

  /** Upload ảnh vào thư mục đang chọn rồi làm mới danh sách (chọn sẵn ảnh mới nhất). */
  async onUploadToFolder(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (this.selectedFolderId() == null) {
      Swal.fire('Chưa chọn thư mục', 'Hãy chọn hoặc tạo thư mục trước.', 'warning');
      input.value = '';
      return;
    }
    if (!file.type.startsWith('image/')) {
      Swal.fire('Không hợp lệ', 'Vui lòng chọn tệp ảnh.', 'warning');
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      Swal.fire('Ảnh quá lớn', 'Ảnh tối đa 5MB.', 'warning');
      input.value = '';
      return;
    }

    this.uploading.set(true);
    try {
      const res = await lastValueFrom(
        this.userService.uploadToFolder(this.selectedFolderId()!, file)
      );
      if (res.isSucceeded) {
        this.page.set(1);
        await this.loadImages();
        // Ảnh mới nhất nằm đầu danh sách -> chọn sẵn.
        const newest = this.images()[0];
        if (newest) {
          this.pickedImageId.set(newest.id);
          this.pickedImageUrl.set(newest.url);
        }
      } else {
        Swal.fire('Lỗi', res.message || 'Tải ảnh lên thất bại.', 'error');
      }
    } catch {
      Swal.fire('Lỗi', 'Tải ảnh lên thất bại. Vui lòng thử lại.', 'error');
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  pickImage(img: FileUploadItem): void {
    this.pickedImageId.set(img.id);
    this.pickedImageUrl.set(img.url);
  }

  /** Áp dụng ảnh đang chọn vào form (chỉ ghi DB khi bấm "Lưu thay đổi"). */
  confirmPick(): void {
    if (this.pickedImageId() == null) return;
    this.avatarId.set(this.pickedImageId());
    this.avatarUrl.set(this.pickedImageUrl());
    this.pickerOpen.set(false);
  }

  removeAvatar(): void {
    this.avatarId.set(null);
    this.avatarUrl.set(null);
  }

  // ------- Lưu thông tin -------
  async saveInfo(): Promise<void> {
    if (!this.firstName().trim() || !this.lastName().trim()) {
      Swal.fire('Thiếu thông tin', 'Vui lòng nhập họ tên đầy đủ.', 'warning');
      return;
    }

    const payload: UpdateUserProfileDto = {
      firstName: this.firstName().trim(),
      lastName: this.lastName().trim(),
      gender: this.gender(),
      phoneNumber: this.phoneNumber().trim() || null,
      // Trường CCCD/CMND đã bỏ khỏi form -> luôn gửi rỗng.
      identityNumber: null,
      addresDetail: this.addresDetail().trim() || null,
      avatarId: this.avatarId(),
    };

    this.savingInfo.set(true);
    try {
      const res = await lastValueFrom(
        this.userService.updateMyProfile(payload)
      );
      if (res.isSucceeded) {
        // Đồng bộ tên + avatar hiển thị ở topbar/sidebar ngay lập tức.
        this.authService.patchCurrentUser({
          fullName: `${payload.firstName} ${payload.lastName}`.trim(),
          avatarUrl: this.avatarUrl() ?? undefined,
        });
        Swal.fire({
          icon: 'success',
          title: 'Đã lưu',
          text: 'Cập nhật hồ sơ thành công.',
          timer: 1600,
          showConfirmButton: false,
        });
      } else {
        Swal.fire('Lỗi', res.message || 'Cập nhật thất bại.', 'error');
      }
    } catch {
      Swal.fire('Lỗi', 'Cập nhật thất bại. Vui lòng thử lại.', 'error');
    } finally {
      this.savingInfo.set(false);
    }
  }

  // ------- Đổi mật khẩu -------
  async changePassword(): Promise<void> {
    if (!this.oldPassword()) {
      Swal.fire('Thiếu thông tin', 'Vui lòng nhập mật khẩu hiện tại.', 'warning');
      return;
    }
    if (!this.passwordValid()) {
      Swal.fire(
        'Mật khẩu chưa đạt',
        'Mật khẩu mới phải tối thiểu 10 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.',
        'warning'
      );
      return;
    }
    if (!this.pwMatch()) {
      Swal.fire('Không khớp', 'Xác nhận mật khẩu không trùng khớp.', 'warning');
      return;
    }

    this.changingPassword.set(true);
    try {
      const res = await lastValueFrom(
        this.userService.changeMyPassword({
          oldPassword: this.oldPassword(),
          newPassword: this.newPassword(),
          confirmNewPassword: this.confirmNewPassword(),
        })
      );
      if (res.isSucceeded) {
        this.oldPassword.set('');
        this.newPassword.set('');
        this.confirmNewPassword.set('');
        Swal.fire({
          icon: 'success',
          title: 'Đã đổi mật khẩu',
          text: 'Mật khẩu của bạn đã được cập nhật.',
          timer: 1800,
          showConfirmButton: false,
        });
      } else {
        Swal.fire('Lỗi', res.message || 'Đổi mật khẩu thất bại.', 'error');
      }
    } catch {
      Swal.fire('Lỗi', 'Đổi mật khẩu thất bại. Vui lòng thử lại.', 'error');
    } finally {
      this.changingPassword.set(false);
    }
  }
}
