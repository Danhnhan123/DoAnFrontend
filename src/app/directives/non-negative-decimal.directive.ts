import { Directive, ElementRef, HostListener, inject } from '@angular/core';

/** Chỉ cho phép nhập số thập phân không âm vào ô input. */
@Directive({
  selector: 'input[appNonNegativeDecimal]',
  standalone: true,
})
export class NonNegativeDecimalDirective {
  private readonly input = inject(ElementRef<HTMLInputElement>);
  private dispatchingSanitizedValue = false;

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey) return;

    const allowedControlKeys = new Set([
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'Home',
      'End',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
    ]);
    if (allowedControlKeys.has(event.key) || /^\d$/.test(event.key)) return;

    if (event.key === '.' && !this.input.nativeElement.value.includes('.')) return;

    event.preventDefault();
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    const pastedValue = event.clipboardData?.getData('text') ?? '';
    if (!this.isNonNegativeDecimal(pastedValue)) event.preventDefault();
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    const droppedValue = event.dataTransfer?.getData('text') ?? '';
    if (!this.isNonNegativeDecimal(droppedValue)) event.preventDefault();
  }

  @HostListener('input')
  onInput(): void {
    if (this.dispatchingSanitizedValue) return;

    const element = this.input.nativeElement;
    if (element.value === '' || this.isNonNegativeDecimal(element.value)) return;

    element.value = '';
    this.dispatchingSanitizedValue = true;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    this.dispatchingSanitizedValue = false;
  }

  private isNonNegativeDecimal(value: string): boolean {
    return /^\d*(?:\.\d*)?$/.test(value);
  }
}
