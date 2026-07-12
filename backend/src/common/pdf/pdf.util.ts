import { existsSync } from 'node:fs';
import PDFDocument from 'pdfkit';
import { AppSetting, Prisma } from '@prisma/client';

/** A4 with comfortable margins; built-in Helvetica covers Uzbek Latin. */
export function buildPdf(
  build: (doc: PDFKit.PDFDocument) => void,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    build(doc);
    doc.end();
  });
}

/** NFR-16: "1 250 000 so'm" (regular spaces, dot decimals). */
export function pdfMoney(
  value: Prisma.Decimal | string | number | null | undefined,
): string {
  if (value === null || value === undefined) return '—';
  const n = Number(value.toString());
  if (Number.isNaN(n)) return String(value);
  const formatted = new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 2,
  })
    .format(n)
    .replace(/,/g, '.')
    .replace(/[  ]/g, ' ');
  return `${formatted} so'm`;
}

export function pdfQty(value: Prisma.Decimal | string | number): string {
  const n = Number(value.toString());
  if (Number.isNaN(n)) return String(value);
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 })
    .format(n)
    .replace(/,/g, '.')
    .replace(/[  ]/g, ' ');
}

/** NFR-16: DD.MM.YYYY */
export function pdfDate(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/** Company requisites block (logo + name + details), returns the y below it. */
export function drawCompanyHeader(
  doc: PDFKit.PDFDocument,
  settings: AppSetting,
): void {
  const left = doc.page.margins.left;
  const textX = settings.logoPath && existsSync(settings.logoPath) ? left + 70 : left;

  if (textX > left) {
    try {
      doc.image(settings.logoPath!, left, doc.y, { fit: [60, 60] });
    } catch {
      // a corrupt logo file must not break document printing
    }
  }

  doc.font('Helvetica-Bold').fontSize(14).text(settings.companyName, textX, doc.y);
  doc.font('Helvetica').fontSize(9).fillColor('#444444');
  const lines = [
    settings.address,
    settings.phone ? `Tel: ${settings.phone}` : null,
    settings.inn ? `STIR: ${settings.inn}` : null,
    settings.bankDetails,
  ].filter(Boolean) as string[];
  for (const line of lines) {
    doc.text(line, textX);
  }
  doc.fillColor('#000000');
  doc.x = left;
  doc.moveDown(1);
  doc
    .moveTo(left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor('#999999')
    .stroke()
    .strokeColor('#000000');
  doc.moveDown(0.8);
}

export interface PdfColumn {
  header: string;
  width: number;
  align?: 'left' | 'right';
}

const ROW_PADDING = 4;

/** Simple bordered table with header repetition on page breaks. */
export function drawTable(
  doc: PDFKit.PDFDocument,
  columns: PdfColumn[],
  rows: string[][],
): void {
  const left = doc.page.margins.left;
  const bottom = doc.page.height - doc.page.margins.bottom;

  const headerHeight = rowHeight(doc, columns, columns.map((c) => c.header), true);
  const drawHeader = () => {
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(9);
    let x = left;
    for (const col of columns) {
      doc
        .rect(x, y, col.width, headerHeight)
        .fillAndStroke('#eeeeee', '#999999');
      doc
        .fillColor('#000000')
        .text(col.header, x + ROW_PADDING, y + ROW_PADDING, {
          width: col.width - ROW_PADDING * 2,
          align: col.align ?? 'left',
        });
      x += col.width;
    }
    doc.y = y + headerHeight;
  };

  drawHeader();
  doc.font('Helvetica').fontSize(9);

  for (const row of rows) {
    const height = rowHeight(doc, columns, row, false);
    if (doc.y + height > bottom) {
      doc.addPage();
      drawHeader();
      doc.font('Helvetica').fontSize(9);
    }
    const y = doc.y;
    let x = left;
    row.forEach((cell, i) => {
      const col = columns[i];
      doc.rect(x, y, col.width, height).stroke('#999999');
      doc
        .fillColor('#000000')
        .text(cell, x + ROW_PADDING, y + ROW_PADDING, {
          width: col.width - ROW_PADDING * 2,
          align: col.align ?? 'left',
        });
      x += col.width;
    });
    doc.y = y + height;
  }
  doc.x = left;
  doc.moveDown(0.8);
}

function rowHeight(
  doc: PDFKit.PDFDocument,
  columns: PdfColumn[],
  cells: string[],
  bold: boolean,
): number {
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
  let max = 0;
  cells.forEach((cell, i) => {
    const h = doc.heightOfString(cell, {
      width: columns[i].width - ROW_PADDING * 2,
    });
    if (h > max) max = h;
  });
  return max + ROW_PADDING * 2;
}
