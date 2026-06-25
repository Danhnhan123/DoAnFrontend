import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface FilterSelectOption {
  id: any;
  name: string;
}

/**
 * Dropdown lọc dùng chung cho toàn bộ bộ lọc nâng cao (đồng bộ giao diện với
 * dropdown của màn Audit Log / Activity Log).
 *
 * - Chọn 1 (mặc định): có mục "Tất cả" để bỏ chọn, value là id (hoặc null).
 * - Chọn nhiều (multiple=true): checkbox, value là mảng id.
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
        type="button"
        class="form-control ms-toggle"
        [class.has-value]="hasValue()"
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
      <div class="ms-menu">
        @if (!multiple) {
        <label class="ms-item" (click)="selectSingle(null)">
          <span class="ms-radio" [class.on]="!hasValue()"></span>
          <span>{{ allLabel }}</span>
        </label>
        } @for (o of options; track o.id) { @if (multiple) {
        <label class="ms-item">
          <input
            type="checkbox"
            [checked]="isChecked(o.id)"
            (change)="toggleMulti(o.id, $any($event.target).checked)"
          />
          <span>{{ o.name }}</span>
        </label>
        } @else {
        <label class="ms-item" (click)="selectSingle(o.id)">
          <span class="ms-radio" [class.on]="o.id === value"></span>
          <span>{{ o.name }}</span>
        </label>
        } } @if (options.length === 0) {
        <div class="ms-empty">Không có dữ liệu</div>
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
      .ms-toggle.has-value {
        border-color: var(--accent, #6366f1);
        color: var(--accent, #6366f1);
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
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        z-index: 50;
        max-height: 240px;
        overflow-y: auto;
        padding: 6px;
        background: var(--card-bg, #fff);
        border: 1px solid var(--border, #e2e8f0);
        border-radius: var(--radius-sm, 8px);
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.14);
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
        border-color: var(--accent, #6366f1);
      }
      .ms-radio.on::after {
        content: '';
        position: absolute;
        inset: 2px;
        border-radius: 50%;
        background: var(--accent, #6366f1);
      }
      .ms-empty {
        padding: 10px 8px;
        font-size: 0.8rem;
        color: var(--text-muted, #94a3b8);
      }
    `,
  ],
})
export class FilterSelectComponent {
  @Input() options: FilterSelectOption[] = [];
  @Input() multiple = false;
  @Input() placeholder = 'Tất cả';
  @Input() allLabel = 'Tất cả';
  @Input() value: any = null;
  @Output() valueChange = new EventEmitter<any>();

  open = signal(false);

  @HostListener('document:click')
  onDocClick(): void {
    this.open.set(false);
  }

  toggle(event: Event): void {
    event.stopPropagation();
    this.open.update((v) => !v);
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
    this.open.set(false);
  }

  label(): string {
    if (this.multiple) {
      const n = this.asArray().length;
      return n === 0 ? this.placeholder : `Đã chọn ${n}`;
    }
    if (!this.hasValue()) return this.allLabel;
    const opt = this.options.find((o) => o.id === this.value);
    return opt ? opt.name : this.placeholder;
  }
}
