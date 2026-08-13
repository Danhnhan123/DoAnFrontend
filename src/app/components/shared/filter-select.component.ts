import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  inject,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface FilterSelectOption {
  id: any;
  name: string;
  /** Vô hiệu hoá riêng option này (không cho chọn). */
  disabled?: boolean;
}

/**
 * Dropdown lọc/chọn dùng chung cho toàn bộ bộ lọc nâng cao và các form
 * (đồng bộ giao diện với dropdown của màn Audit Log / Activity Log).
 *
 * - Chọn 1 (mặc định): có mục "Tất cả" để bỏ chọn, value là id (hoặc null).
 * - Chọn nhiều (multiple=true): checkbox, value là mảng id.
 * - Option có thể set disabled riêng: { id, name, disabled: true }.
 *
 * Menu được render bằng position:fixed neo theo nút bấm nên KHÔNG bị cắt bởi
 * container cha có overflow:hidden/auto (card, table-wrap, modal-body…).
 *
 * Dùng:
 *   <app-filter-select [options]="opts()" [value]="filter()"
 *      (valueChange)="filter.set($event)" allLabel="Tất cả"></app-filter-select>
 */
@Component({
  selector: 'app-filter-select',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ms-dropdown" (click)="$event.stopPropagation()">
      <button
        #toggleBtn
        type="button"
        class="form-control ms-toggle"
        [class.has-value]="hasValue()"
        [disabled]="disabled"
        (click)="toggle($event)"
      >
        <span class="ms-label">{{ label() }}</span>
        <svg
          class="ms-caret"
          [class.open]="open()"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      @if (open()) {
      <div class="ms-menu" [ngStyle]="menuStyle()">
        @if (searchable) {
        <div class="ms-search" (click)="$event.stopPropagation()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            #searchInput
            type="text"
            [value]="searchTerm()"
            [placeholder]="searchPlaceholder"
            (input)="searchTerm.set($any($event.target).value)"
            (keydown.escape)="close()"
          />
        </div>
        }
        @if (!multiple && clearable) {
        <label class="ms-item" (click)="selectSingle(null)">
          <span class="ms-radio" [class.on]="!hasValue()"></span>
          <span>{{ allLabel }}</span>
        </label>
        } @for (o of filteredOptions(); track o.id) { @if (multiple) {
        <label class="ms-item" [class.disabled]="o.disabled">
          <input
            type="checkbox"
            [checked]="isChecked(o.id)"
            [disabled]="o.disabled"
            (change)="toggleMulti(o.id, $any($event.target).checked)"
          />
          <span>{{ o.name }}</span>
        </label>
        } @else {
        <label
          class="ms-item"
          [class.disabled]="o.disabled"
          (click)="o.disabled ? null : selectSingle(o.id)"
        >
          <span class="ms-radio" [class.on]="o.id === value"></span>
          <span>{{ o.name }}</span>
        </label>
        } } @if (filteredOptions().length === 0) {
        <div class="ms-empty">{{ searchTerm() ? 'Không tìm thấy kết quả' : 'Không có dữ liệu' }}</div>
        }
        @if (allowCreate && searchTerm().trim() && filteredOptions().length === 0) {
        <button type="button" class="ms-create" (click)="requestCreate($event)">
          <span>＋</span> {{ createLabel }} “{{ searchTerm().trim() }}”
        </button>
        }
      </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .ms-dropdown {
        position: relative;
        width: 100%;
      }
      .ms-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        width: 100%;
        text-align: left;
        cursor: pointer;
        background: var(--card-bg, #fff);
      }
      .ms-toggle:disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }
      .ms-toggle.has-value {
        border-color: var(--accent, #16a34a);
        color: var(--accent, #16a34a);
      }
      .ms-label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ms-caret {
        flex-shrink: 0;
        transition: transform 0.18s ease;
        opacity: 0.7;
      }
      .ms-caret.open {
        transform: rotate(180deg);
      }
      .ms-menu {
        position: fixed;
        z-index: 1200;
        max-height: 240px;
        overflow-y: auto;
        padding: 6px;
        background: var(--card-bg, #fff);
        border: 1px solid var(--border, #e2e8f0);
        border-radius: var(--radius-sm, 8px);
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.14);
      }
      .ms-search {
        position: sticky;
        top: -6px;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: 7px;
        margin: -2px -2px 5px;
        padding: 7px 8px;
        color: var(--text-muted, #94a3b8);
        background: var(--card-bg, #fff);
        border-bottom: 1px solid var(--border, #e2e8f0);
      }
      .ms-search input {
        min-width: 0;
        width: 100%;
        padding: 0;
        border: 0;
        outline: 0;
        color: var(--text-primary, #1e293b);
        background: transparent;
        font: inherit;
      }
      .ms-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 7px 8px;
        border-radius: 6px;
        font-size: 0.82rem;
        color: var(--text-primary, #1e293b);
        cursor: pointer;
      }
      .ms-item:hover {
        background: var(--bg-tertiary, #eef1f7);
      }
      .ms-item.disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .ms-item.disabled:hover {
        background: transparent;
      }
      .ms-item input {
        flex-shrink: 0;
      }
      .ms-radio {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 2px solid var(--border, #cbd5e1);
        flex-shrink: 0;
        position: relative;
      }
      .ms-radio.on {
        border-color: var(--accent, #16a34a);
      }
      .ms-radio.on::after {
        content: '';
        position: absolute;
        inset: 2px;
        border-radius: 50%;
        background: var(--accent, #16a34a);
      }
      .ms-empty {
        padding: 10px 8px;
        font-size: 0.8rem;
        color: var(--text-muted, #94a3b8);
      }
      .ms-create {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        margin-top: 4px;
        padding: 8px;
        border: 0;
        border-top: 1px solid var(--border, #e2e8f0);
        background: transparent;
        color: var(--accent, #16a34a);
        font: inherit;
        font-weight: 650;
        text-align: left;
        cursor: pointer;
      }
      .ms-create:hover { background: var(--bg-tertiary, #eef1f7); }
    `,
  ],
})
export class FilterSelectComponent implements AfterViewInit, OnDestroy {
  @Input() options: FilterSelectOption[] = [];
  @Input() multiple = false;
  @Input() placeholder = 'Tất cả';
  @Input() allLabel = 'Tất cả';
  /** Cho phép bỏ chọn (hiện mục "Tất cả"). Tắt cho select bắt buộc / chọn số dòng/trang. */
  @Input() clearable = true;
  /** Vô hiệu hóa dropdown (không cho mở). */
  @Input() disabled = false;
  /** Cho phép gõ để lọc option theo tên, không phân biệt hoa/thường và dấu tiếng Việt. */
  @Input() searchable = false;
  @Input() searchPlaceholder = 'Nhập để tìm kiếm...';
  @Input() allowCreate = false;
  @Input() createLabel = 'Thêm mới';
  @Input() value: any = null;
  @Output() valueChange = new EventEmitter<any>();
  @Output() createRequest = new EventEmitter<string>();

  @ViewChild('toggleBtn') toggleBtn?: ElementRef<HTMLButtonElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  private readonly host = inject(ElementRef<HTMLElement>);

  open = signal(false);
  searchTerm = signal('');
  filteredOptions(): FilterSelectOption[] {
    const keyword = this.normalize(this.searchTerm());
    if (!this.searchable || !keyword) return this.options;
    return this.options.filter((option) => this.normalize(option.name).includes(keyword));
  }
  /** Toạ độ menu (position:fixed) để không bị cắt bởi overflow của ancestor. */
  private menuPos = signal<{ [k: string]: string }>({});

  private readonly reposition = (event?: Event) => {
    if (!this.open()) return;
    // Bỏ qua khi cuộn NGAY BÊN TRONG dropdown/menu (menu có overflow-y:auto):
    // chỉ cuộn nội dung menu, không được đóng dropdown.
    const target = event?.target as Node | null;
    if (target && this.host.nativeElement.contains(target)) return;
    // Cuộn/resize ở ngoài lúc menu đang mở: đóng lại để tránh menu "trôi" khỏi nút.
    this.open.set(false);
  };

  ngAfterViewInit(): void {
    // capture=true để bắt cả cuộn của container bên trong (modal-body, table-wrap…).
    window.addEventListener('scroll', this.reposition, true);
    window.addEventListener('resize', this.reposition);
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.reposition, true);
    window.removeEventListener('resize', this.reposition);
  }

  @HostListener('document:click')
  onDocClick(): void {
    this.close();
  }

  menuStyle(): { [k: string]: string } {
    return this.menuPos();
  }

  private computePosition(): void {
    const el = this.toggleBtn?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const menuMaxHeight = 252; // 240 max-height + padding/border
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < menuMaxHeight && rect.top > spaceBelow;
    const style: { [k: string]: string } = {
      left: `${Math.round(rect.left)}px`,
      width: `${Math.round(rect.width)}px`,
    };
    if (openUp) {
      style['bottom'] = `${Math.round(window.innerHeight - rect.top + 4)}px`;
    } else {
      style['top'] = `${Math.round(rect.bottom + 4)}px`;
    }
    this.menuPos.set(style);
  }

  toggle(event: Event): void {
    event.stopPropagation();
    if (this.disabled) return;
    const next = !this.open();
    if (next) {
      this.searchTerm.set('');
      this.computePosition();
    }
    this.open.set(next);
    if (next && this.searchable) {
      setTimeout(() => this.searchInput?.nativeElement.focus());
    }
  }

  close(): void {
    this.open.set(false);
    this.searchTerm.set('');
  }

  requestCreate(event: Event): void {
    event.stopPropagation();
    const value = this.searchTerm().trim();
    if (!value) return;
    this.createRequest.emit(value);
    this.close();
  }

  private normalize(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('vi')
      .trim();
  }

  private asArray(): any[] {
    return Array.isArray(this.value) ? this.value : [];
  }

  hasValue(): boolean {
    return this.multiple
      ? this.asArray().length > 0
      : this.value !== null && this.value !== undefined && this.value !== '';
  }

  isChecked(id: any): boolean {
    return this.multiple ? this.asArray().includes(id) : this.value === id;
  }

  toggleMulti(id: any, checked: boolean): void {
    const arr = this.asArray();
    const next = checked ? [...arr, id] : arr.filter((x) => x !== id);
    this.valueChange.emit(next);
  }

  selectSingle(id: any): void {
    this.valueChange.emit(id);
    this.close();
  }

  label(): string {
    if (this.multiple) {
      const n = this.asArray().length;
      return n === 0 ? this.placeholder : `Đã chọn ${n}`;
    }
    if (!this.hasValue()) return this.clearable ? this.allLabel : this.placeholder;
    const opt = this.options.find((o) => o.id === this.value);
    return opt ? opt.name : this.placeholder;
  }
}
