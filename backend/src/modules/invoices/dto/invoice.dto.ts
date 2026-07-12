import { IsIn, IsInt } from 'class-validator';

export class CreateInvoiceDto {
  @IsInt({ message: 'Buyurtma tanlanishi shart' })
  orderId!: number;
}

export class UpdateInvoiceStatusDto {
  // paid is set automatically by payments (FR-3.5)
  @IsIn(['sent'], { message: "Faqat 'sent' holatiga o'tkazish mumkin" })
  status!: 'sent';
}
