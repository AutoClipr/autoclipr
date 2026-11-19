import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  full_name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  /** Public URL after avatar upload, or empty string to remove. */
  @IsOptional()
  @IsString()
  avatar_url?: string;

  @IsOptional()
  @IsBoolean()
  email_notifications_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  clips_ready_email_notifications?: boolean;

  @IsOptional()
  @IsBoolean()
  platform_email_notifications?: boolean;

  @IsOptional()
  @IsBoolean()
  scheduler_email_notifications?: boolean;
}
