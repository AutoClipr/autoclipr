import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { THROTTLE } from '../../config/throttle.config';
import { ApiResponse } from '../../common/api-response';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard, AuthUser } from '../../common/guards/jwt-auth.guard';
import { parsePagination } from '../../common/utils/pagination';
import { SubtitleUploadDto, SubtitleValidateDto } from './dto/layout.dto';
import { VideosService } from './videos.service';
import { InitUploadDto } from './dto/init-upload.dto';
import { ImportUrlDto } from './dto/import-url.dto';
import { DeleteVideoDto } from './dto/delete-video.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';

@ApiTags('Videos')
@ApiBearerAuth('JWT')
@Controller('videos')
@UseGuards(JwtAuthGuard)
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  /** Signed upload URL for an .srt subtitle file. */
  @Post('subtitles')
  async subtitleUpload(@CurrentUser() user: AuthUser, @Body() dto: SubtitleUploadDto) {
    return ApiResponse.ok(await this.videosService.createSubtitleUpload(user.sub, dto));
  }

  /** Parse an uploaded .srt and report cues / problems. */
  @Post('subtitles/validate')
  @HttpCode(200)
  async subtitleValidate(@CurrentUser() user: AuthUser, @Body() dto: SubtitleValidateDto) {
    return ApiResponse.ok(await this.videosService.validateSubtitle(user.sub, dto.path));
  }

  @Post('upload')
  async initUpload(@CurrentUser() user: AuthUser, @Body() dto: InitUploadDto) {
    const data = await this.videosService.initUpload(user.sub, dto);
    return ApiResponse.ok(data);
  }

  @Throttle({
    default: {
      limit: THROTTLE.expensive.limit,
      ttl: THROTTLE.expensive.ttl,
    },
  })
  @Post('import-url')
  async importUrl(@CurrentUser() user: AuthUser, @Body() dto: ImportUrlDto) {
    const data = await this.videosService.importFromUrl(user.sub, dto);
    return ApiResponse.ok(data);
  }

  @Post('delete')
  async deleteByBody(@CurrentUser() user: AuthUser, @Body() dto: DeleteVideoDto) {
    const result = await this.videosService.delete(user.sub, dto.video_id);
    return ApiResponse.ok(result);
  }

  @Post(':id/complete')
  async complete(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CompleteUploadDto,
  ) {
    const data = await this.videosService.completeUpload(user.sub, id, dto ?? {});
    return ApiResponse.ok(data);
  }

  /** Has this user already uploaded this video? Checked before a new upload. */
  @Get('duplicate')
  async duplicate(
    @CurrentUser() user: AuthUser,
    @Query('title') title?: string,
    @Query('duration') duration?: string,
    @Query('size') size?: string,
  ) {
    const num = (v?: string) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);
    const match = await this.videosService.findDuplicate(user.sub, title ?? '', num(duration), num(size));
    return ApiResponse.ok({ duplicate: match });
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const { page: p, limit: l } = parsePagination(
      parseInt(page ?? '1', 10),
      parseInt(limit ?? '20', 10),
    );
    const { items, total } = await this.videosService.list(user.sub, p, l);
    return ApiResponse.ok(items, {
      page: p,
      limit: l,
      total,
      has_more: p * l < total,
    });
  }

  @Throttle({
    default: {
      limit: THROTTLE.polling.limit,
      ttl: THROTTLE.polling.ttl,
    },
  })
  @Get(':id/pipeline')
  async pipeline(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const data = await this.videosService.getPipeline(user.sub, id);
    return ApiResponse.ok(data);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const video = await this.videosService.get(user.sub, id);
    return ApiResponse.ok(video);
  }

  @Delete(':id')
  async delete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const result = await this.videosService.delete(user.sub, id);
    return ApiResponse.ok(result);
  }

  @Post(':id/delete')
  async deleteViaPost(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const result = await this.videosService.delete(user.sub, id);
    return ApiResponse.ok(result);
  }
}
