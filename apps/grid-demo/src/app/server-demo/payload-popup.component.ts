import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-payload-popup',
  templateUrl: './payload-popup.component.html',
  styleUrls: ['./payload-popup.component.css']
})
export class PayloadPopupComponent {
  @Input() payload: any = null;
  @Input() visible: boolean = false;
  @Output() close = new EventEmitter<void>();

  get payloadType(): 'json' | 'xml' | 'text' | 'unknown' {
    if (!this.payload) return 'unknown';
    
    const payloadStr = typeof this.payload === 'string' 
      ? this.payload 
      : JSON.stringify(this.payload, null, 2);
    
    // Check for XML
    if (payloadStr.trim().startsWith('<?xml') || payloadStr.trim().startsWith('<')) {
      return 'xml';
    }
    
    // Check for JSON
    try {
      JSON.parse(payloadStr);
      return 'json';
    } catch {
      return 'text';
    }
  }

  get formattedPayload(): string {
    if (!this.payload) return '';
    
    if (typeof this.payload === 'string') {
      if (this.payloadType === 'json') {
        try {
          return JSON.stringify(JSON.parse(this.payload), null, 2);
        } catch {
          return this.payload;
        }
      }
      return this.payload;
    }
    
    return JSON.stringify(this.payload, null, 2);
  }

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('popup-backdrop')) {
      this.onClose();
    }
  }

  copyToClipboard(): void {
    const text = this.formattedPayload;
    navigator.clipboard.writeText(text).then(() => {
      // You could show a toast notification here
      console.log('Copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }
}
