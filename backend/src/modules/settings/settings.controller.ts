import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateSettingsDto } from './dto/settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  // accountant needs requisites for the invoice PDF (section 8)
  @Get()
  @Roles(Role.admin, Role.accountant)
  get() {
    return this.service.get();
  }

  @Patch()
  @Roles(Role.admin)
  update(@Body() dto: UpdateSettingsDto, @CurrentUser() user: AuthUser) {
    return this.service.update(dto, user.id);
  }

  @Post('logo')
  @Roles(Role.admin)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 1024 * 1024 } }),
  )
  uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Fayl yuklanmadi');
    return this.service.saveLogo(file, user.id);
  }
}
