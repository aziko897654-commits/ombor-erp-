import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional } from 'class-validator';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

class MarkReadDto {
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  ids?: number[];

  @IsOptional()
  @IsBoolean()
  all?: boolean;
}

/** FR-7.1: every role sees only its own notifications. */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.service.list(user.id, page, limit);
  }

  @Patch('read')
  markRead(@CurrentUser() user: AuthUser, @Body() dto: MarkReadDto) {
    return this.service.markRead(user.id, dto.ids, dto.all);
  }
}
