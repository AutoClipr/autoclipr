import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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
  @IsIn(['animated', 'emoji', 'karaoke', 'viral'])
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
}
