import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { NumberingService } from '../../common/numbering/numbering.service';
import {
  buildPdf,
  drawCompanyHeader,
  drawTable,
  pdfDate,
  pdfMoney,
  pdfQty,
} from '../../common/pdf/pdf.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

const ZERO = new Prisma.Decimal(0);

const INVOICE_INCLUDE = {
  order: {
    select: {
      id: true,
      number: true,
      total: true,
      createdAt: true,
      customer: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.InvoiceInclude;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  async findAll(
    page: number,
    limit: number,
    status?: InvoiceStatus,
    sort?: 'asc' | 'desc',
  ) {
    const where: Prisma.InvoiceWhereInput = status ? { status } : {};
    const [invoices, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: INVOICE_INCLUDE,
        orderBy: sort ? { issuedAt: sort } : { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    // paid amount per order (computed, NFR-10)
    const orderIds = invoices.map((i) => i.orderId);
    const sums = orderIds.length
      ? await this.prisma.payment.groupBy({
          by: ['orderId'],
          where: { orderId: { in: orderIds }, direction: 'in' },
          _sum: { amount: true },
        })
      : [];
    const paidByOrder = new Map(
      sums.map((s) => [s.orderId!, s._sum.amount ?? ZERO]),
    );

    return {
      data: invoices.map((invoice) => {
        const paid = paidByOrder.get(invoice.orderId) ?? ZERO;
        // TASK-007: partial payment is derived, never stored (NFR-10) —
        // 0 < paid < total on a non-paid invoice shows as "partial"
        const displayStatus =
          invoice.status !== 'paid' &&
          paid.greaterThan(ZERO) &&
          paid.lessThan(invoice.order.total)
            ? 'partial'
            : invoice.status;
        return {
          ...invoice,
          paidTotal: paid.toString(),
          displayStatus,
        };
      }),
      meta: { page, limit, total },
    };
  }

  /** FR-3.5: invoice for a confirmed/shipped order, one per order. */
  async create(orderId: number, userId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { invoice: true },
    });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');
    if (order.status !== 'confirmed' && order.status !== 'shipped') {
      throw new BadRequestException(
        'Hisob-faktura faqat tasdiqlangan buyurtma uchun yaratiladi',
      );
    }
    if (order.invoice) {
      throw new ConflictException(
        `Bu buyurtma uchun hisob-faktura mavjud: ${order.invoice.number}`,
      );
    }

    const invoice = await this.prisma
      .$transaction(async (tx) => {
        const number = await this.numbering.next(tx, 'invoice');

        // orders already fully paid before invoicing flip straight to paid
        const agg = await tx.payment.aggregate({
          where: { orderId, direction: 'in' },
          _sum: { amount: true },
        });
        const paid = agg._sum.amount ?? ZERO;
        const isPaid = paid.greaterThanOrEqualTo(order.total);

        const created = await tx.invoice.create({
          data: {
            number,
            orderId,
            status: isPaid ? 'paid' : 'draft',
            paidAt: isPaid ? new Date() : null,
          },
        });
        await this.audit.log(
          {
            userId,
            action: 'invoice.create',
            entity: 'Invoice',
            entityId: created.id,
            details: { number, order: order.number },
          },
          tx,
        );
        return created;
      })
      .catch((e) => {
        // unique orderId: a concurrent create won the race
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          throw new ConflictException(
            'Bu buyurtma uchun hisob-faktura allaqachon mavjud',
          );
        }
        throw e;
      });

    return this.prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: INVOICE_INCLUDE,
    });
  }

  /** Manual status flow is draft→sent only; paid is automatic. */
  async setStatus(id: number, status: 'sent', userId: number) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Hisob-faktura topilmadi');
    if (invoice.status !== 'draft') {
      throw new BadRequestException(
        "Faqat qoralama (draft) hisob-faktura 'sent' holatiga o'tkaziladi",
      );
    }
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status },
      include: INVOICE_INCLUDE,
    });
    await this.audit.log({
      userId,
      action: 'invoice.status',
      entity: 'Invoice',
      entityId: id,
      details: { number: invoice.number, status },
    });
    return updated;
  }

  /** FR-3.5: A4 PDF with company requisites from settings. */
  async pdf(id: number): Promise<{ number: string; buffer: Buffer }> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            customer: true,
            items: {
              include: {
                product: { select: { name: true, sku: true, unit: true } },
              },
            },
          },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Hisob-faktura topilmadi');

    const settings = await this.settings.get();
    const order = invoice.order;

    const paidAgg = await this.prisma.payment.aggregate({
      where: { orderId: order.id, direction: 'in' },
      _sum: { amount: true },
    });
    const paid = paidAgg._sum.amount ?? ZERO;

    const buffer = await buildPdf((doc) => {
      drawCompanyHeader(doc, settings);

      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .text(`HISOB-FAKTURA ${invoice.number}`, { align: 'center' });
      doc
        .font('Helvetica')
        .fontSize(10)
        .text(`Sana: ${pdfDate(invoice.issuedAt)}`, { align: 'center' });
      doc.moveDown(1);

      doc.font('Helvetica-Bold').fontSize(10).text('Mijoz:', { continued: true });
      doc.font('Helvetica').text(` ${order.customer.name}`);
      if (order.customer.phone) {
        doc.text(`Telefon: ${order.customer.phone}`);
      }
      if (order.customer.address) {
        doc.text(`Manzil: ${order.customer.address}`);
      }
      doc.text(
        `Buyurtma: ${order.number} (${pdfDate(order.createdAt)})`,
      );
      doc.moveDown(1);

      drawTable(
        doc,
        [
          { header: '#', width: 25 },
          { header: 'Mahsulot', width: 190 },
          { header: 'Birlik', width: 45 },
          { header: 'Miqdor', width: 65, align: 'right' },
          { header: 'Narx', width: 90, align: 'right' },
          { header: 'Summa', width: 100, align: 'right' },
        ],
        order.items.map((item, i) => [
          String(i + 1),
          `${item.product.name} (${item.product.sku})`,
          item.product.unit,
          pdfQty(item.quantity),
          pdfMoney(item.price),
          pdfMoney(item.quantity.times(item.price)),
        ]),
      );

      const right = { align: 'right' as const };
      doc.font('Helvetica').fontSize(10);
      doc.text(`Oraliq jami: ${pdfMoney(order.subtotal)}`, right);
      doc.text(`Chegirma: ${pdfMoney(order.discount)}`, right);
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(`JAMI: ${pdfMoney(order.total)}`, right);
      doc
        .font('Helvetica')
        .fontSize(10)
        .text(
          `To'langan: ${pdfMoney(paid)} / Qoldiq: ${pdfMoney(order.total.minus(paid))}`,
          right,
        );

      if (settings.invoiceFooter) {
        doc.moveDown(2);
        doc
          .font('Helvetica-Oblique')
          .fontSize(9)
          .fillColor('#555555')
          .text(settings.invoiceFooter, { align: 'center' })
          .fillColor('#000000');
      }
    });

    return { number: invoice.number, buffer };
  }
}
