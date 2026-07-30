import { Directive, ElementRef, Input, effect, inject, signal } from '@angular/core';
import { PermissionService } from '../services/permission.service';

/**
 * Directive ẩn phần tử (thường là nút) khi user KHÔNG có quyền tương ứng.
 * Dùng dạng ATTRIBUTE (không phải structural *) nên không xung đột với *ngIf/*ngFor sẵn có.
 *
 * Cú pháp: [appHasPerm]="'CODE:ACTION'"
 *   - CODE   = Code menu (vd PRODUCT, USER, INBOUND_ORDERS...)
 *   - ACTION = CREATE | READ | UPDATE | DELETE | EXPORT | APPROVE
 *
 * Ví dụ:
 *   <button [appHasPerm]="'PRODUCT:CREATE'">Thêm mới</button>   // ẩn nếu không có quyền tạo
 *   <button [appHasPerm]="'INBOUND_ORDERS:UPDATE'">Duyệt</button> // duyệt/từ chối = UPDATE
 *
 * Phản ứng theo signal quyền của user: khi đổi vai trò & đăng nhập lại, nút tự cập nhật.
 * Lưu ý: chỉ là lớp UX; backend vẫn chặn thật bằng CustomAuthorize.
 */
@Directive({
  selector: '[appHasPerm]',
  standalone: true,
})
export class HasPermissionDirective {
  private readonly perm = inject(PermissionService);
  private readonly el = inject(ElementRef<HTMLElement>);

  private readonly expr = signal<string>('');

  @Input('appHasPerm') set appHasPerm(value: string) {
    this.expr.set(value || '');
  }

  constructor() {
    effect(() => {
      const expr = this.expr();
      const allowed = expr ? this.perm.canExpr(expr) : true;
      const style = (this.el.nativeElement as HTMLElement).style;
      if (allowed) {
        style.removeProperty('display');
      } else {
        style.setProperty('display', 'none', 'important');
      }
    });
  }
}
