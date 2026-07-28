import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  AuditEvent,
  EventBus,
} from '../../common/events/event-bus.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizePhone } from '../auth/auth.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { ProductsService } from '../products/products.service';

interface TgContact {
  phone_number: string;
  user_id?: number;
}
interface TgMessage {
  message_id: number;
  chat: { id: number };
  from?: { id: number };
  text?: string;
  contact?: TgContact;
}
interface TgCallback {
  id: string;
  from: { id: number };
  data?: string;
  message?: TgMessage;
}
interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallback;
}

type ConvoState = {
  step: 'name' | 'phone';
  firstName?: string;
  lastName?: string;
};

/**
 * Telegram bot integration (@erp_tizim_bot).
 * - Long-polling (getUpdates) — works on localhost, no webhook.
 * - Account linking: share phone → matched to an ERP User.
 * - Registration: /register → admin approves via inline buttons + picks a role.
 * - Commands: /savdo, /qoldiq, /qarzlar.
 * - Every audit-log action is forwarded to linked admins.
 *
 * Runs while the backend process runs; for true 24/7 keep the backend
 * deployed/running (render.yaml).
 */
@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Telegram');
  private apiBase = '';
  private offset = 0;
  private enabled = false;
  private polling = false;
  /** Per-chat multi-step registration state (lost on restart — harmless). */
  private readonly convo = new Map<number, ConvoState>();
  /** Hourly report timers (aligned to the top of the hour). */
  private reportTimeout?: NodeJS.Timeout;
  private reportTimer?: NodeJS.Timeout;
  /** Serial outbound queue — Telegram rate-limit (~30 msg/s) himoyasi. */
  private sendQueue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardService,
    private readonly products: ProductsService,
    private readonly bus: EventBus,
  ) {}

  onModuleInit(): void {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN')?.trim();
    if (!token) {
      this.logger.warn("TELEGRAM_BOT_TOKEN yo'q — Telegram bot o'chirilgan.");
      return;
    }
    this.apiBase = `https://api.telegram.org/bot${token}`;
    this.enabled = true;
    this.bus.onAudit((e) => void this.onAudit(e));
    void this.setup();
    void this.pollLoop();
    this.scheduleHourly();
    this.logger.log('Telegram bot ishga tushdi (long-polling).');
  }

  onModuleDestroy(): void {
    this.polling = false;
    if (this.reportTimeout) clearTimeout(this.reportTimeout);
    if (this.reportTimer) clearInterval(this.reportTimer);
  }

  // --------------------------------------------------------------- outbound

  async sendMessage(
    chatId: string | number,
    text: string,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    if (!this.enabled) return;
    // Barcha yuborishlar bitta navbatда ketma-ket + kichik oraliq bilan
    // ketadi, shunda ko'p hodisada Telegram rate-limitидan oshmaydi.
    const task = this.sendQueue.then(async () => {
      try {
        await this.call('sendMessage', {
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          ...extra,
        });
      } catch (e) {
        this.logger.warn(`sendMessage: ${(e as Error).message}`);
      }
      await sleep(45);
    });
    this.sendQueue = task.catch(() => undefined);
    return task;
  }

  /** Mirrors an in-app notification to any of the given users who linked Telegram. */
  async notifyUsers(userIds: number[], title: string, body: string): Promise<void> {
    if (!this.enabled || userIds.length === 0) return;
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, telegramChatId: { not: null } },
      select: { telegramChatId: true },
    });
    const text = `🔔 <b>${esc(title)}</b>\n${esc(body)}`;
    for (const u of users) {
      if (u.telegramChatId) await this.sendMessage(u.telegramChatId, text);
    }
  }

  /** Forwards every audited action to linked admins ("hamma hodisa adminga"). */
  private async onAudit(e: AuditEvent): Promise<void> {
    if (!this.enabled) return;
    try {
      const admins = await this.linkedAdmins();
      if (admins.length === 0) return;
      const actor = await this.prisma.user.findUnique({
        where: { id: e.userId },
        select: { firstName: true, lastName: true },
      });
      const who = actor ? `${actor.firstName} ${actor.lastName}` : `#${e.userId}`;
      const where = e.entityId
        ? `${entityLabel(e.entity)} #${e.entityId}`
        : entityLabel(e.entity);
      const text = `📝 <b>${esc(actionLabel(e.action))}</b>\n👤 ${esc(who)} · ${esc(where)}`;
      for (const a of admins) {
        if (a.telegramChatId) await this.sendMessage(a.telegramChatId, text);
      }
    } catch (err) {
      this.logger.warn(`onAudit: ${(err as Error).message}`);
    }
  }

  // ----------------------------------------------------------- hourly report

  /** Fires once at the top of each hour ("saytdan botga 1 soatda 1"). */
  private scheduleHourly(): void {
    const now = new Date();
    const msToNextHour =
      (60 - now.getMinutes()) * 60_000 -
      now.getSeconds() * 1000 -
      now.getMilliseconds();
    this.reportTimeout = setTimeout(() => {
      void this.hourlyReport();
      this.reportTimer = setInterval(
        () => void this.hourlyReport(),
        60 * 60 * 1000,
      );
    }, msToNextHour);
  }

  private async hourlyReport(): Promise<void> {
    if (!this.enabled) return;
    try {
      const admins = await this.linkedAdmins();
      if (admins.length === 0) return;
      const text = await this.buildReport();
      for (const a of admins) {
        if (a.telegramChatId) await this.sendMessage(a.telegramChatId, text);
      }
    } catch (e) {
      this.logger.warn(`hourlyReport: ${(e as Error).message}`);
    }
  }

  private async buildReport(): Promise<string> {
    const s = await this.dashboard.summary();
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes(),
    ).padStart(2, '0')}`;
    return [
      `⏰ <b>Soatlik hisobot</b> — ${hhmm}`,
      `📊 Davr: ${esc(s.period.label)}`,
      '',
      `💰 Tushum: <b>${money(s.kpi.income.value)}</b>`,
      `💸 Xarajat: <b>${money(s.kpi.expense.value)}</b>`,
      `📈 Sof foyda: <b>${money(s.kpi.profit.value)}</b>`,
      `🏦 Pul qoldig’i: <b>${money(s.kpi.cash.value)}</b>`,
      '',
      `🤝 Ochiq bitimlar: <b>${s.cards.openDealsCount}</b>`,
      `⚠️ Kam zaxira: <b>${s.cards.lowStockCount}</b> ta`,
      `👥 Mijozlar qarzi: <b>${money(s.cards.receivables)}</b>`,
    ].join('\n');
  }

  // ---------------------------------------------------------------- polling

  private async pollLoop(): Promise<void> {
    this.polling = true;
    while (this.polling) {
      try {
        const updates = (await this.call('getUpdates', {
          offset: this.offset,
          timeout: 30,
          allowed_updates: ['message', 'callback_query'],
        })) as TgUpdate[];
        for (const u of updates) {
          this.offset = u.update_id + 1;
          await this.handleUpdate(u).catch((e) =>
            this.logger.warn(`handleUpdate: ${(e as Error).message}`),
          );
        }
      } catch {
        await sleep(3000); // network hiccup / 409 — back off, keep going
      }
    }
  }

  private async handleUpdate(u: TgUpdate): Promise<void> {
    if (u.callback_query) return this.handleCallback(u.callback_query);
    const msg = u.message;
    if (!msg) return;
    const chatId = msg.chat.id;
    const text = (msg.text ?? '').trim();
    const isCommand = text.startsWith('/');

    // Registration wizard in progress → capture name / phone.
    if (!isCommand && this.convo.has(chatId)) {
      return this.registrationStep(chatId, msg);
    }

    // Contact outside a wizard → link an existing account.
    if (msg.contact) {
      if (msg.contact.user_id && msg.from && msg.contact.user_id !== msg.from.id) {
        await this.sendMessage(chatId, "Iltimos, o'zingizning raqamingizni yuboring.");
        return;
      }
      return this.linkByPhone(chatId, msg.contact.phone_number);
    }

    const cmd = text.split(/\s+/)[0].toLowerCase().replace(/@.*/, '');
    switch (cmd) {
      case '/start':
        return this.cmdStart(chatId);
      case '/register':
        return this.startRegistration(chatId);
      case '/help':
      case '/menu':
        return this.cmdHelp(chatId);
      case '/savdo':
        return this.guarded(chatId, () => this.cmdSavdo(chatId));
      case '/qoldiq':
        return this.guarded(chatId, () => this.cmdQoldiq(chatId));
      case '/qarzlar':
        return this.guarded(chatId, () => this.cmdQarzlar(chatId));
      case '/pending':
        return this.cmdPending(chatId);
      case '/hisobot':
        return this.guarded(chatId, async () =>
          this.sendMessage(chatId, await this.buildReport()),
        );
      default: {
        if (text.replace(/\D/g, '').length >= 9) {
          return this.linkByPhone(chatId, text);
        }
        return this.sendMessage(chatId, 'Buyruq tanilmadi. /help ni bosing.');
      }
    }
  }

  // --------------------------------------------------------- linking / start

  private async cmdStart(chatId: number): Promise<void> {
    const user = await this.userByChat(chatId);
    if (user) {
      await this.sendMessage(
        chatId,
        `Salom, <b>${esc(user.firstName)}</b>! Hisobingiz bog'langan.\n/help — buyruqlar.`,
        { reply_markup: { remove_keyboard: true } },
      );
      return;
    }
    await this.sendMessage(
      chatId,
      [
        'Assalomu alaykum! Bu — <b>ERP tizimi</b> boti.',
        '',
        "• Hisobingiz allaqachon bo'lsa — telefon raqamingizni yuboring (tugma orqali).",
        '• Yangi foydalanuvchi bo\'lsangiz — /register buyrug\'i bilan ro\'yxatdan o\'ting.',
      ].join('\n'),
      {
        reply_markup: {
          keyboard: [
            [{ text: '📱 Telefon raqamni yuborish', request_contact: true }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      },
    );
  }

  private async linkByPhone(chatId: number, rawPhone: string): Promise<void> {
    const phone = normalizePhone(rawPhone);
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user || !user.isActive) {
      await this.sendMessage(
        chatId,
        `❌ <b>${esc(phone)}</b> ERP tizimida topilmadi.\nYangi foydalanuvchi bo'lsangiz /register bilan ro'yxatdan o'ting.`,
        { reply_markup: { remove_keyboard: true } },
      );
      return;
    }
    await this.bindChat(user.id, chatId);
    await this.sendMessage(
      chatId,
      `✅ Hisob bog'landi: <b>${esc(user.firstName)} ${esc(user.lastName)}</b> (${esc(roleLabel(user.role))}).\n/help — buyruqlar.`,
      { reply_markup: { remove_keyboard: true } },
    );
  }

  // ------------------------------------------------------------- registration

  private async startRegistration(chatId: number): Promise<void> {
    const user = await this.userByChat(chatId);
    if (user) {
      await this.sendMessage(chatId, "Siz allaqachon tizimga bog'langansiz.");
      return;
    }
    this.convo.set(chatId, { step: 'name' });
    await this.sendMessage(
      chatId,
      "📝 <b>Ro'yxatdan o'tish</b>\n\nTo'liq ismingizni yozing (masalan: Anvar Karimov).",
      { reply_markup: { remove_keyboard: true } },
    );
  }

  private async registrationStep(chatId: number, msg: TgMessage): Promise<void> {
    const state = this.convo.get(chatId);
    if (!state) return;

    if (state.step === 'name') {
      const parts = (msg.text ?? '').trim().split(/\s+/).filter(Boolean);
      if (parts.length === 0) {
        await this.sendMessage(chatId, "Ismingizni yozing (masalan: Anvar Karimov).");
        return;
      }
      state.firstName = parts[0];
      state.lastName = parts.slice(1).join(' ') || '-';
      state.step = 'phone';
      await this.sendMessage(
        chatId,
        'Telefon raqamingizni yuboring (tugma orqali yoki yozib).',
        {
          reply_markup: {
            keyboard: [
              [{ text: '📱 Telefon raqamni yuborish', request_contact: true }],
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        },
      );
      return;
    }

    // step === 'phone'
    const raw = msg.contact?.phone_number ?? msg.text ?? '';
    if (raw.replace(/\D/g, '').length < 9) {
      await this.sendMessage(chatId, "To'g'ri telefon raqam yuboring.");
      return;
    }
    this.convo.delete(chatId);
    await this.submitRegistration(
      chatId,
      state.firstName ?? '-',
      state.lastName ?? '-',
      normalizePhone(raw),
    );
  }

  private async submitRegistration(
    chatId: number,
    firstName: string,
    lastName: string,
    phone: string,
  ): Promise<void> {
    const dup = await this.prisma.user.findUnique({ where: { phone } });
    if (dup) {
      await this.sendMessage(
        chatId,
        `Bu raqam (${esc(phone)}) allaqachon ro'yxatda. Saytga telefon + parol bilan kiring.`,
        { reply_markup: { remove_keyboard: true } },
      );
      return;
    }
    const reg = await this.prisma.pendingRegistration.create({
      data: {
        telegramChatId: String(chatId),
        firstName,
        lastName,
        phone,
        status: 'pending',
      },
    });
    await this.sendMessage(
      chatId,
      "✅ So'rovingiz yuborildi. Administrator tasdiqlashini kuting.",
      { reply_markup: { remove_keyboard: true } },
    );

    const admins = await this.linkedAdmins();
    if (admins.length === 0) {
      this.logger.warn("Ro'yxatdan o'tish: bog'langan admin yo'q.");
      return;
    }
    const text = [
      "🆕 <b>Yangi ro'yxatdan o'tish so'rovi</b>",
      '',
      `👤 ${esc(firstName)} ${esc(lastName)}`,
      `📱 ${esc(phone)}`,
    ].join('\n');
    const reply_markup = {
      inline_keyboard: [
        [
          { text: '✅ Tasdiqlash', callback_data: `reg_ok:${reg.id}` },
          { text: '❌ Rad etish', callback_data: `reg_no:${reg.id}` },
        ],
      ],
    };
    for (const a of admins) {
      if (a.telegramChatId) await this.sendMessage(a.telegramChatId, text, { reply_markup });
    }
  }

  // ---------------------------------------------------------- admin callbacks

  private async handleCallback(cb: TgCallback): Promise<void> {
    const data = cb.data ?? '';
    const presser = await this.userByChat(cb.from.id);
    if (!presser || presser.role !== Role.admin) {
      await this.answerCallback(cb.id, 'Faqat admin tasdiqlay oladi.');
      return;
    }
    if (data.startsWith('reg_ok:')) {
      await this.answerCallback(cb.id);
      return this.showRoleButtons(cb, Number(data.split(':')[1]));
    }
    if (data.startsWith('reg_no:')) {
      await this.answerCallback(cb.id, 'Rad etildi');
      return this.rejectRegistration(cb, Number(data.split(':')[1]));
    }
    if (data.startsWith('reg_role:')) {
      const [, idStr, role] = data.split(':');
      await this.answerCallback(cb.id);
      return this.approveRegistration(cb, Number(idStr), role as Role);
    }
    await this.answerCallback(cb.id);
  }

  private async showRoleButtons(cb: TgCallback, id: number): Promise<void> {
    const reg = await this.prisma.pendingRegistration.findUnique({ where: { id } });
    if (!reg || reg.status !== 'pending') {
      return this.editCallback(cb, "So'rov allaqachon ko'rib chiqilgan.");
    }
    const roles: Array<[string, Role]> = [
      ['👑 Admin', Role.admin],
      ['🧮 Buxgalter', Role.accountant],
      ['📦 Omborchi', Role.warehouse],
      ['🛒 Savdo', Role.sales],
      ['👥 HR', Role.hr],
    ];
    const reply_markup = {
      inline_keyboard: [
        ...chunk(
          roles.map(([label, r]) => ({
            text: label,
            callback_data: `reg_role:${id}:${r}`,
          })),
          2,
        ),
        [{ text: '❌ Bekor', callback_data: `reg_no:${id}` }],
      ],
    };
    await this.editCallback(
      cb,
      `Rolni tanlang — <b>${esc(reg.firstName)} ${esc(reg.lastName)}</b> (${esc(reg.phone)}):`,
      reply_markup,
    );
  }

  private async approveRegistration(
    cb: TgCallback,
    id: number,
    role: Role,
  ): Promise<void> {
    if (!Object.values(Role).includes(role)) {
      return this.editCallback(cb, "Noto'g'ri rol.");
    }
    // Atomik da'vo: faqat 'pending' bo'lsa 'approved' ga o'tadi. Ikki admin
    // bir vaqtda tasdiqlasa, faqat bittasi count=1 oladi (ikki User yaratilmaydi).
    const claimed = await this.prisma.pendingRegistration.updateMany({
      where: { id, status: 'pending' },
      data: { status: 'approved' },
    });
    if (claimed.count === 0) {
      return this.editCallback(cb, "So'rov allaqachon ko'rib chiqilgan.");
    }
    const reg = await this.prisma.pendingRegistration.findUnique({ where: { id } });
    if (!reg) return this.editCallback(cb, "So'rov topilmadi.");
    const dup = await this.prisma.user.findUnique({ where: { phone: reg.phone } });
    if (dup) {
      await this.prisma.pendingRegistration.update({
        where: { id },
        data: { status: 'rejected' },
      });
      return this.editCallback(cb, 'Bu raqam allaqachon foydalanuvchi — bekor qilindi.');
    }
    const password = randomPassword();
    const email = `${reg.phone.replace(/\D/g, '')}@telegram.erp`;
    // free this chat's link if it was tied elsewhere (telegramChatId is unique)
    await this.prisma.user.updateMany({
      where: { telegramChatId: reg.telegramChatId },
      data: { telegramChatId: null },
    });
    await this.prisma.user.create({
      data: {
        firstName: reg.firstName,
        lastName: reg.lastName,
        email,
        phone: reg.phone,
        telegramChatId: reg.telegramChatId,
        role,
        passwordHash: await bcrypt.hash(password, 10),
        isActive: true,
      },
    });
    // status yuqorida atomik ravishda 'approved' qilingan.
    await this.sendMessage(
      reg.telegramChatId,
      [
        '✅ <b>Hisobingiz tasdiqlandi!</b>',
        '',
        'Saytga kirish uchun:',
        `📱 Login (telefon): <code>${esc(reg.phone)}</code>`,
        `🔑 Parol: <code>${esc(password)}</code>`,
        '',
        "Kirganingizdan so'ng parolni o'zgartiring.",
      ].join('\n'),
    );
    await this.editCallback(
      cb,
      `✅ Tasdiqlandi: <b>${esc(reg.firstName)} ${esc(reg.lastName)}</b> — ${esc(roleLabel(role))}`,
    );
  }

  private async rejectRegistration(cb: TgCallback, id: number): Promise<void> {
    // Atomik da'vo (approve bilan bir xil poyga himoyasi).
    const claimed = await this.prisma.pendingRegistration.updateMany({
      where: { id, status: 'pending' },
      data: { status: 'rejected' },
    });
    if (claimed.count === 0) {
      return this.editCallback(cb, "So'rov allaqachon ko'rib chiqilgan.");
    }
    const reg = await this.prisma.pendingRegistration.findUnique({ where: { id } });
    if (!reg) return this.editCallback(cb, "So'rov topilmadi.");
    await this.sendMessage(
      reg.telegramChatId,
      "❌ Ro'yxatdan o'tish so'rovingiz rad etildi.",
    );
    await this.editCallback(
      cb,
      `❌ Rad etildi: <b>${esc(reg.firstName)} ${esc(reg.lastName)}</b>`,
    );
  }

  // --------------------------------------------------------------- commands

  private cmdHelp(chatId: number): Promise<void> {
    return this.sendMessage(
      chatId,
      [
        '<b>ERP bot buyruqlari</b>',
        '',
        '/register — ro’yxatdan o’tish (admin tasdig’i bilan)',
        '/savdo — joriy davr moliyaviy ko’rsatkichlari',
        '/qoldiq — kam zaxiradagi mahsulotlar',
        '/qarzlar — mijoz va yetkazib beruvchi qarzlari',
        '/hisobot — hozirgi holat (soatlik hisobot avtomat keladi)',
        '/pending — (admin) kutilayotgan ro’yxatdan o’tish so’rovlari',
        '/help — shu ro’yxat',
      ].join('\n'),
    );
  }

  private async cmdSavdo(chatId: number): Promise<void> {
    const s = await this.dashboard.summary();
    await this.sendMessage(
      chatId,
      [
        `📊 <b>Moliyaviy ko’rsatkichlar</b> — ${esc(s.period.label)}`,
        '',
        `💰 Tushum: <b>${money(s.kpi.income.value)}</b>`,
        `💸 Xarajat: <b>${money(s.kpi.expense.value)}</b>`,
        `📈 Sof foyda: <b>${money(s.kpi.profit.value)}</b>`,
        `🏦 Pul qoldig’i: <b>${money(s.kpi.cash.value)}</b>`,
        '',
        `🤝 Ochiq bitimlar: <b>${s.cards.openDealsCount}</b> (${money(s.cards.openDealsTotal)})`,
        `📦 Ombor qiymati: <b>${money(s.cards.stockValue)}</b>`,
      ].join('\n'),
    );
  }

  private async cmdQoldiq(chatId: number): Promise<void> {
    const low = await this.products.findLowStock();
    if (low.length === 0) {
      await this.sendMessage(chatId, '✅ Kam zaxiradagi mahsulot yo’q.');
      return;
    }
    const lines = low
      .slice(0, 30)
      .map(
        (p) =>
          `• ${esc(p.name)} (${esc(p.sku)}) — <b>${p.stock}</b> ${esc(p.unit)} (min ${p.minStock.toString()})`,
      );
    const more = low.length > 30 ? `\n… va yana ${low.length - 30} ta` : '';
    await this.sendMessage(
      chatId,
      `⚠️ <b>Kam zaxira (${low.length})</b>\n\n${lines.join('\n')}${more}`,
    );
  }

  /** Admin-only: review registration requests queued while offline. */
  private async cmdPending(chatId: number): Promise<void> {
    const user = await this.userByChat(chatId);
    if (!user || user.role !== Role.admin) {
      await this.sendMessage(chatId, 'Bu buyruq faqat administrator uchun.');
      return;
    }
    const pend = await this.prisma.pendingRegistration.findMany({
      where: { status: 'pending' },
      orderBy: { id: 'asc' },
    });
    if (pend.length === 0) {
      await this.sendMessage(chatId, "✅ Kutilayotgan so'rov yo'q.");
      return;
    }
    for (const reg of pend) {
      await this.sendMessage(
        chatId,
        [
          `🆕 <b>So'rov #${reg.id}</b>`,
          `👤 ${esc(reg.firstName)} ${esc(reg.lastName)}`,
          `📱 ${esc(reg.phone)}`,
        ].join('\n'),
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Tasdiqlash', callback_data: `reg_ok:${reg.id}` },
                { text: '❌ Rad etish', callback_data: `reg_no:${reg.id}` },
              ],
            ],
          },
        },
      );
    }
  }

  private async cmdQarzlar(chatId: number): Promise<void> {
    const s = await this.dashboard.summary();
    await this.sendMessage(
      chatId,
      [
        '🧾 <b>Qarzdorlik</b>',
        '',
        `👥 Mijozlar qarzi (bizga): <b>${money(s.cards.receivables)}</b>`,
        `🚚 Yetkazib beruvchilarga qarz: <b>${money(s.cards.payables)}</b>`,
      ].join('\n'),
    );
  }

  // ----------------------------------------------------------------- helpers

  private guarded(chatId: number, fn: () => Promise<void>): Promise<void> {
    return this.userByChat(chatId).then((user) =>
      user ? fn() : this.cmdStart(chatId),
    );
  }

  private userByChat(chatId: number) {
    return this.prisma.user.findUnique({
      where: { telegramChatId: String(chatId) },
    });
  }

  private async bindChat(userId: number, chatId: number): Promise<void> {
    await this.prisma.user.updateMany({
      where: { telegramChatId: String(chatId) },
      data: { telegramChatId: null },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { telegramChatId: String(chatId) },
    });
  }

  private linkedAdmins() {
    return this.prisma.user.findMany({
      where: { role: Role.admin, isActive: true, telegramChatId: { not: null } },
      select: { telegramChatId: true },
    });
  }

  private async setup(): Promise<void> {
    try {
      await this.call('setMyCommands', {
        commands: [
          { command: 'start', description: 'Boshlash / hisobni bog’lash' },
          { command: 'register', description: 'Ro’yxatdan o’tish' },
          { command: 'savdo', description: 'Moliyaviy ko’rsatkichlar' },
          { command: 'qoldiq', description: 'Kam zaxira' },
          { command: 'qarzlar', description: 'Qarzdorlik' },
          { command: 'hisobot', description: 'Hozirgi holat hisoboti' },
          { command: 'help', description: 'Buyruqlar ro’yxati' },
        ],
      });
    } catch (e) {
      this.logger.warn(`setMyCommands: ${(e as Error).message}`);
    }
  }

  private answerCallback(id: string, text?: string): Promise<void> {
    return this.callSafe('answerCallbackQuery', {
      callback_query_id: id,
      ...(text ? { text } : {}),
    });
  }

  private async editCallback(
    cb: TgCallback,
    text: string,
    replyMarkup?: object,
  ): Promise<void> {
    if (!cb.message) return;
    await this.callSafe('editMessageText', {
      chat_id: cb.message.chat.id,
      message_id: cb.message.message_id,
      text,
      parse_mode: 'HTML',
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
  }

  private async callSafe(method: string, body: Record<string, unknown>): Promise<void> {
    try {
      await this.call(method, body);
    } catch (e) {
      this.logger.warn(`${method}: ${(e as Error).message}`);
    }
  }

  private async call(method: string, body: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(`${this.apiBase}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      ok: boolean;
      result?: unknown;
      description?: string;
    };
    if (!json.ok) throw new Error(json.description ?? 'telegram error');
    return json.result;
  }
}

// ---------------------------------------------------------------- utilities

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Escapes the 3 characters that matter for Telegram HTML parse mode. */
function esc(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** "10800000" → "10 800 000 so'm". */
function money(v: string | number): string {
  const n = Math.round(Number(v) || 0);
  return `${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so'm`;
}

function randomPassword(len = 8): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    admin: 'Administrator',
    accountant: 'Buxgalter',
    warehouse: 'Omborchi',
    sales: 'Savdo menejeri',
    hr: 'HR menejeri',
  };
  return map[role] ?? role;
}

/** Turns "order.confirm" → "Buyurtma tasdiqlandi" for the admin feed. */
function actionLabel(action: string): string {
  const [entity, verb] = action.split('.');
  const e = entityLabel(entity);
  const verbs: Record<string, string> = {
    create: "qo'shildi",
    update: "o'zgartirildi",
    delete: "o'chirildi",
    confirm: 'tasdiqlandi',
    cancel: 'bekor qilindi',
    pay: "to'lov qilindi",
    payment: "to'lov",
    complete: 'yakunlandi',
    close: 'yopildi',
    receive: 'qabul qilindi',
    ship: 'jo\'natildi',
    return: 'qaytarildi',
  };
  const v = verbs[verb] ?? verb ?? '';
  return v ? `${e} ${v}` : e;
}

function entityLabel(entity: string): string {
  const map: Record<string, string> = {
    order: 'Buyurtma',
    payment: "To'lov",
    user: 'Foydalanuvchi',
    product: 'Mahsulot',
    purchase: 'Xarid',
    deal: 'Bitim',
    customer: 'Mijoz',
    supplier: 'Yetkazib beruvchi',
    invoice: 'Faktura',
    transaction: 'Tranzaksiya',
    stock: 'Ombor',
    employee: 'Xodim',
    payroll: 'Oylik',
    transfer: "O'tkazma",
    category: 'Kategoriya',
    warehouse: 'Ombor',
    settings: 'Sozlama',
    account: 'Hisob',
    advance: 'Avans',
    attendance: 'Davomat',
  };
  const key = (entity ?? '').toLowerCase();
  return map[key] ?? (entity || '-');
}
