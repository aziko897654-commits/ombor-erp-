import { Controller, Get, Query } from '@nestjs/common';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { SearchService } from './search.service';

/** FR-10.1: available to every authenticated role, results filtered. */
@Controller('search')
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @Get()
  search(@Query('q') q = '', @CurrentUser() user: AuthUser) {
    return this.service.search(q, user.role);
  }
}
