import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export const ASPECT_RATIOS = ['9:16', '16:9', '1:1', '4:5'] as const;

/** Output frame + layout for rendering. Plan access is checked in the service. */
export class LayoutDto {
  @IsOptional() @IsIn([...ASPECT_RATIOS]) aspect_ratio?: string;
  /** Only single-source layouts are rendered today. */
  @IsOptional() @IsIn(['fill', 'fit']) layout?: string;
  @IsOptional() @IsIn(['original', '4:3', '1:1']) crop_ratio?: string;
  @IsOptional() @IsIn(['blur', 'black', 'color']) background?: string;
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) background_color?: string;
  @IsOptional() @IsIn(['center', 'top', 'bottom']) position?: string;
}

export class SubtitleUploadDto {
  @IsString() filename!: string;
  @IsInt() @Min(1) @Max(1_048_576) size!: number;
}

export class SubtitleValidateDto {
  @IsString() path!: string;
}
