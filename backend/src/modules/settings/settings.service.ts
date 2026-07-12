import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { BadRequestException, Injectable } from '@nestjs/common';
import { AppSetting } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateSettingsDto } from './dto/settings.dto';

const UPLOADS_DIR = 'uploads';

// NFR-6: only PNG/JPG; the stored filename is always regenerated
const EXT_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
};

/** FR-9: singleton company settings (id=1), used by invoice PDF. */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<AppSetting> {
    const existing = await this.prisma.appSetting.findUnique({
      where: { id: 1 },
    });
    if (existing) return existing;
    // FR-9.3: the singleton row is created lazily if the seed was skipped
    return this.prisma.appSetting.create({
      data: { id: 1, companyName: 'Kompaniya' },
    });
  }

  async update(dto: UpdateSettingsDto, userId: number): Promise<AppSetting> {
    await this.get();
    const updated = await this.prisma.appSetting.update({
      where: { id: 1 },
      data: dto,
    });
    await this.audit.log({
      userId,
      action: 'settings.update',
      entity: 'AppSetting',
      entityId: 1,
      details: { fields: Object.keys(dto) },
    });
    return updated;
  }

  /** FR-9.2 + NFR-6: logo upload into local uploads/. */
  async saveLogo(file: Express.Multer.File, userId: number): Promise<AppSetting> {
    const ext = EXT_BY_MIME[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Faqat PNG yoki JPG rasm qabul qilinadi');
    }
    if (file.size > 1024 * 1024) {
      throw new BadRequestException('Rasm hajmi 1 MB dan oshmasligi kerak');
    }

    const current = await this.get();

    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    const fileName = `logo-${randomUUID()}${ext}`;
    const relativePath = path.posix.join(UPLOADS_DIR, fileName);
    await fs.writeFile(path.join(UPLOADS_DIR, fileName), file.buffer);

    // best-effort cleanup of the previous logo file
    if (current.logoPath) {
      await fs.unlink(current.logoPath).catch(() => undefined);
    }

    const updated = await this.prisma.appSetting.update({
      where: { id: 1 },
      data: { logoPath: relativePath },
    });
    await this.audit.log({
      userId,
      action: 'settings.logo',
      entity: 'AppSetting',
      entityId: 1,
      details: { logoPath: relativePath },
    });
    return updated;
  }
}
