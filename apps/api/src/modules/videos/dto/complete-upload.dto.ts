import { IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { CAPTION_STYLE_IDS } from './caption-styles';

/** Clip options chosen on the create screen after a file upload (all optional). */
export class CompleteUploadDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  clip_count?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  durations?: number[];

  @IsOptional()
  @IsString()
  @IsIn([...CAPTION_STYLE_IDS])
  caption_style?: string;

  @IsOptional()
  @IsString()
  @IsIn(['en', 'hi', 'es', 'fr', 'de', 'ar'])
  caption_language?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platforms?: string[];

  @IsOptional()
  @IsString()
  @IsIn(['hd', 'full_hd', '4k'])
  export_quality?: string;

  /** Length the browser measured, for an early limit check (worker re-verifies). */
  @IsOptional()
  @Min(0)
  @Max(86400)
  source_duration_seconds?: number;

  /** A brand kit to apply. Resolved and checked server-side (plan + ownership). */
  @IsOptional()
  @IsString()
  @Matches(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|preset:[a-z0-9-]{1,40})$/i)
  brand_kit_id?: string;
}
