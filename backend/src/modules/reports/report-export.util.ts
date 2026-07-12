import * as ExcelJS from 'exceljs';
import {
  buildPdf,
  drawTable,
  pdfDate,
  type PdfColumn,
} from '../../common/pdf/pdf.util';
import type { Period } from '../../common/period.util';

export interface ReportColumn {
  key: string;
  label: string;
  align?: 'left' | 'right';
  /** money columns are numbers in xlsx and right-aligned in pdf */
  money?: boolean;
}

export interface ReportSection {
  title: string;
  columns: ReportColumn[];
  rows: Array<Record<string, string | number | null>>;
}

export interface Report {
  slug: string;
  title: string;
  period?: Period;
  sections: ReportSection[];
}

/** FR-6.1: every report exports to .xlsx. */
export async function reportToXlsx(report: Report): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const section of report.sections) {
    // sheet names: max 31 chars, no special chars
    const sheet = workbook.addWorksheet(
      section.title.replace(/[\\/*?:[\]]/g, ' ').slice(0, 31),
    );
    sheet.addRow(section.columns.map((c) => c.label));
    sheet.getRow(1).font = { bold: true };
    for (const row of section.rows) {
      sheet.addRow(
        section.columns.map((c) => {
          const value = row[c.key];
          if (c.money && value !== null && value !== undefined) {
            return Number(value);
          }
          return value ?? '';
        }),
      );
    }
    sheet.columns.forEach((column, i) => {
      column.width = Math.max(14, section.columns[i].label.length + 4);
      if (section.columns[i].money) column.numFmt = '#,##0.00';
    });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** FR-6.1: every report exports to PDF (A4). */
export function reportToPdf(report: Report): Promise<Buffer> {
  return buildPdf((doc) => {
    doc.font('Helvetica-Bold').fontSize(15).text(report.title, {
      align: 'center',
    });
    if (report.period) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#444444')
        .text(
          `Davr: ${pdfDate(report.period.start)} — ${pdfDate(report.period.end)}`,
          { align: 'center' },
        )
        .fillColor('#000000');
    }
    doc.moveDown(1);

    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    for (const section of report.sections) {
      doc.font('Helvetica-Bold').fontSize(11).text(section.title);
      doc.moveDown(0.4);
      const weight = section.columns.reduce(
        (acc, c) => acc + (c.money ? 1.2 : 1),
        0,
      );
      const columns: PdfColumn[] = section.columns.map((c) => ({
        header: c.label,
        width: (pageWidth * (c.money ? 1.2 : 1)) / weight,
        align: c.align ?? (c.money ? 'right' : 'left'),
      }));
      const rows = section.rows.map((row) =>
        section.columns.map((c) => {
          const value = row[c.key];
          if (value === null || value === undefined) return '—';
          if (c.money) return formatPdfMoney(value);
          return String(value);
        }),
      );
      drawTable(doc, columns, rows);
      doc.moveDown(0.6);
    }
  });
}

function formatPdfMoney(value: string | number): string {
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })
    .format(n)
    .replace(/,/g, '.')
    .replace(/[  ]/g, ' ');
}
