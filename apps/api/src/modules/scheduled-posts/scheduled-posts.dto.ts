import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Platforms the worker can actually publish to today. */
export const SCHEDULER_PLATFORMS = ['youtube', 'instagram'] as const;
export type SchedulerPlatform = (typeof SCHEDULER_PLATFORMS)[number];

export const UPLOAD_EXTENSIONS = ['mp4', 'mov', 'webm', 'm4v'] as const;
/** 500 MB — Instagram's own Reels limit is 1 GB, YouTube's far higher. */
export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

export class ScheduledTargetDto {
  @IsIn(SCHEDULER_PLATFORMS)
  platform!: SchedulerPlatform;

  /** Platform-specific caption; falls back to the post caption. */
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption_override?: string;
}

export class CreateScheduledPostDto {
  /** A generated clip from the library … */
  @IsOptional()
  @IsUUID()
  clip_id?: string;

  /** … or a file uploaded through /scheduled-posts/uploads. */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  media_storage_path?: string;

  @IsOptional()
  @IsNumber()
  media_duration_seconds?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  hashtags?: string;

  @IsArray()
  @ArrayMaxSize(SCHEDULER_PLATFORMS.length)
  @ValidateNested({ each: true })
  @Type(() => ScheduledTargetDto)
  targets!: ScheduledTargetDto[];

  /** UTC ISO timestamp. Required unless saving a draft. */
  @IsOptional()
  @IsISO8601()
  scheduled_at?: string;

  /** IANA zone the user picked, kept for display. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  /** `draft` saves without scheduling. */
  @IsOptional()
  @IsIn(['draft', 'scheduled'])
  status?: 'draft' | 'scheduled';
}

export class RescheduleDto {
  @IsISO8601()
  scheduled_at!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}

export class RetryDto {
  /** Retry only this destination; omit to retry every failed one. */
  @IsOptional()
  @IsIn(SCHEDULER_PLATFORMS)
  platform?: SchedulerPlatform;
}

export class UploadUrlDto {
  @IsString()
  @MaxLength(200)
  filename!: string;

  @IsString()
  @MaxLength(100)
  mime_type!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES)
  size!: number;
}

export class ListScheduledPostsQuery {
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsIn(SCHEDULER_PLATFORMS)
  platform?: SchedulerPlatform;
}
