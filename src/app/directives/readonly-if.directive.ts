import { Directive, ElementRef, Input, OnDestroy, effect, inject, signal } from '@angular/core';

/**
 * Khi bật (true), vô hiệu hoá TẤT CẢ input/select/textarea bên trong phần tử host
 * (dùng cho popup "chỉ xem": không có quyền UPDATE thì mở popup ở chế độ đọc).
 * Không đụng tới các nút (Đóng/Huỷ vẫn bấm được); nút Lưu ẩn riêng bằng [hidden]="viewOnly()".
 *
 * MutationObserver để khoá cả các field render sau (tab/khối *ngIf mở sau khi popup hiện).
 */
@Directive({
  selector: '[appReadonlyIf]',
  standalone: true,
})
export class ReadonlyIfDirective implements OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly on = signal(false);
  private observer?: MutationObserver;
  private readonly lockedByUs = new Set<HTMLElement>();

  @Input({ alias: 'appReadonlyIf' }) set value(v: boolean) {
    this.on.set(!!v);
  }

  constructor() {
    effect(() => {
      if (this.on()) this.activate();
      else this.deactivate();
    });
  }

  private lockNow(): void {
    const nodes = this.el.nativeElement.querySelectorAll('input, select, textarea');
    nodes.forEach((node: Element) => {
      const c = node as HTMLInputElement;
      if (!c.disabled) {
        c.disabled = true;
        this.lockedByUs.add(c);
      }
    });
  }

  private activate(): void {
    this.lockNow();
    this.observer?.disconnect();
    this.observer = new MutationObserver(() => this.lockNow());
    this.observer.observe(this.el.nativeElement, { childList: true, subtree: true });
  }

  private deactivate(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    this.lockedByUs.forEach((c) => ((c as HTMLInputElement).disabled = false));
    this.lockedByUs.clear();
  }

  ngOnDestroy(): void {
    this.deactivate();
  }
}
