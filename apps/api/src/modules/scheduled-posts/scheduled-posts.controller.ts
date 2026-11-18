import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '../../common/api-response';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser, JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CreateScheduledPostDto,
  ListScheduledPostsQuery,
  RescheduleDto,
  RetryDto,
  UploadUrlDto,
} from './scheduled-posts.dto';
import { ScheduledPostsService } from './scheduled-posts.service';

/** Content Scheduler. Every route is scoped to the signed-in user's own posts. */
@ApiTags('Scheduled posts')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('scheduled-posts')
export class ScheduledPostsController {
  constructor(private readonly service: ScheduledPostsService) {}

  @Post('uploads')
  async uploadUrl(@CurrentUser() user: AuthUser, @Body() dto: UploadUrlDto) {
    return ApiResponse.ok(await this.service.createUploadUrl(user.sub, dto));
  }

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query() q: ListScheduledPostsQuery) {
    return ApiResponse.ok(await this.service.list(user.sub, q));
  }

  /** Same as the list, for a calendar's visible date range. */
  @Get('calendar')
  async calendar(@CurrentUser() user: AuthUser, @Query() q: ListScheduledPostsQuery) {
    return ApiResponse.ok(await this.service.list(user.sub, q));
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return ApiResponse.ok(await this.service.get(user.sub, id));
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateScheduledPostDto) {
    return ApiResponse.ok(await this.service.create(user.sub, dto));
  }

  @Patch(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateScheduledPostDto) {
    return ApiResponse.ok(await this.service.update(user.sub, id, dto));
  }

  @Patch(':id/reschedule')
  async reschedule(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RescheduleDto) {
    return ApiResponse.ok(await this.service.reschedule(user.sub, id, dto));
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return ApiResponse.ok(await this.service.remove(user.sub, id));
  }

  @Post(':id/publish-now')
  @HttpCode(200)
  async publishNow(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return ApiResponse.ok(await this.service.publishNow(user.sub, id));
  }

  @Post(':id/retry')
  @HttpCode(200)
  async retry(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RetryDto) {
    return ApiResponse.ok(await this.service.retry(user.sub, id, dto));
  }
}
