import { Injectable } from '@angular/core';
import { ColumnDef } from '../types';

/**
 * Service for exporting grid data
 */
@Injectable()
export class ExportService {
  /**
   * Export data to CSV
   */
  exportToCSV<T>(data: T[], columns: ColumnDef<T>[], filename: string = 'export.csv'): void {
    const headers = columns
      .filter(col => col.visible !== false)
      .map(col => col.title || col.field);
    
    const rows = data.map(row => {
      return columns
        .filter(col => col.visible !== false)
        .map(col => {
          const value = this.getFieldValue(row, col.field);
          const formatted = col.valueFormatter 
            ? col.valueFormatter(value, row, col)
            : String(value ?? '');
          // Escape commas and quotes
          return `"${formatted.replace(/"/g, '""')}"`;
        })
        .join(',');
    });
    
    const csvContent = [
      headers.join(','),
      ...rows
    ].join('\n');
    
    this.downloadFile(csvContent, filename, 'text/csv');
  }

  /**
   * Export data to Excel (CSV format with .xlsx extension)
   */
  exportToExcel<T>(data: T[], columns: ColumnDef<T>[], filename: string = 'export.xlsx'): void {
    // Simple implementation - exports as CSV with .xlsx extension
    // For full Excel support, you would need a library like xlsx
    this.exportToCSV(data, columns, filename.replace('.xlsx', '.csv'));
  }

  /**
   * Export data to PDF
   */
  exportToPDF<T>(data: T[], columns: ColumnDef<T>[], filename: string = 'export.pdf'): void {
    // Simple implementation - creates HTML table and prints
    // For full PDF support, you would need a library like jsPDF or pdfmake
    const table = this.createHTMLTable(data, columns);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${filename}</title>
            <style>
              table { border-collapse: collapse; width: 100%; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; font-weight: bold; }
            </style>
          </head>
          <body>
            ${table}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  }

  /**
   * Create HTML table from data
   */
  private createHTMLTable<T>(data: T[], columns: ColumnDef<T>[]): string {
    const headers = columns
      .filter(col => col.visible !== false)
      .map(col => `<th>${col.title || col.field}</th>`)
      .join('');
    
    const rows = data.map(row => {
      const cells = columns
        .filter(col => col.visible !== false)
        .map(col => {
          const value = this.getFieldValue(row, col.field);
          const formatted = col.valueFormatter 
            ? col.valueFormatter(value, row, col)
            : String(value ?? '');
          return `<td>${this.escapeHtml(formatted)}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    
    return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  /**
   * Get field value from object using dot notation
   */
  private getFieldValue(obj: any, field: string): any {
    return field.split('.').reduce((o, p) => o?.[p], obj);
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Download file
   */
  private downloadFile(content: string, filename: string, contentType: string): void {
    const blob = new Blob([content], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}


