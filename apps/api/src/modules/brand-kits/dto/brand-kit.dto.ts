import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ALIGNMENTS,
  ASSET_KINDS,
  BRAND_CAPTION_PRESETS,
  BRAND_FONTS,
  CAPTION_POSITIONS,
  LOGO_POSITIONS,
} from '../brand-kit.constants';

const HEX = /^#[0-9a-fA-F]{6}$/;
const HEX_MSG = 'must be a #RRGGBB colour';

export class BrandColorsDto {
  @IsOptional() @Matches(HEX, { message: `primary ${HEX_MSG}` }) primary?: string;
  @IsOptional() @Matches(HEX, { message: `secondary ${HEX_MSG}` }) secondary?: string;
  @IsOptional() @Matches(HEX, { message: `accent ${HEX_MSG}` }) accent?: string;
  @IsOptional() @Matches(HEX, { message: `background ${HEX_MSG}` }) background?: string;
  @IsOptional() @Matches(HEX, { message: `text ${HEX_MSG}` }) text?: string;
}

export class BrandTypographyDto {
  @IsOptional() @IsIn([...BRAND_FONTS]) heading_font?: string;
  @IsOptional() @IsIn([...BRAND_FONTS]) caption_font?: string;
  @IsOptional() @IsInt() @IsIn([400, 600, 700, 800, 900]) font_weight?: number;
  @IsOptional() @IsIn(['small', 'medium', 'large']) text_size?: string;
  @IsOptional() @IsIn([...ALIGNMENTS]) alignment?: string;
}

export class BrandCaptionsDto {
  @IsOptional() @IsIn(Object.keys(BRAND_CAPTION_PRESETS)) preset?: string;
  @IsOptional() @IsIn([...BRAND_FONTS]) font?: string;
  @IsOptional() @IsInt() @Min(40) @Max(140) size?: number;
  @IsOptional() @Matches(HEX, { message: `color ${HEX_MSG}` }) color?: string;
  @IsOptional() @Matches(HEX, { message: `highlight_color ${HEX_MSG}` }) highlight_color?: string;
  @IsOptional() @Matches(HEX, { message: `background_color ${HEX_MSG}` }) background_color?: string;
  @IsOptional() @IsBoolean() background?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(12) outline?: number;
  @IsOptional() @IsInt() @Min(0) @Max(8) shadow?: number;
  @IsOptional() @IsIn([...CAPTION_POSITIONS]) position?: string;
  @IsOptional() @IsIn([...ALIGNMENTS]) alignment?: string;
  @IsOptional() @IsInt() @Min(1) @Max(8) max_words?: number;
}

export class BrandLogoDto {
  @IsOptional() @IsIn([...LOGO_POSITIONS]) position?: string;
  /** Logo width as a percentage of the frame width. */
  @IsOptional() @IsInt() @Min(5) @Max(40) size?: number;
  @IsOptional() @IsNumber() @Min(0.1) @Max(1) opacity?: number;
}

export class CreateBrandKitDto {
  @IsString() @Length(1, 60) name!: string;
  @IsOptional() @IsString() @MaxLength(280) description?: string;

  /** Object paths from POST /brand-kits/assets; null clears. */
  @IsOptional() @IsString() @MaxLength(300) logo_path?: string | null;
  @IsOptional() @IsString() @MaxLength(300) intro_path?: string | null;
  @IsOptional() @IsString() @MaxLength(300) outro_path?: string | null;
  @IsOptional() @IsBoolean() intro_enabled?: boolean;
  @IsOptional() @IsBoolean() outro_enabled?: boolean;

  @IsOptional() @ValidateNested() @Type(() => BrandColorsDto) colors?: BrandColorsDto;
  @IsOptional() @ValidateNested() @Type(() => BrandTypographyDto) typography?: BrandTypographyDto;
  @IsOptional() @ValidateNested() @Type(() => BrandCaptionsDto) captions?: BrandCaptionsDto;
  @IsOptional() @ValidateNested() @Type(() => BrandLogoDto) logo?: BrandLogoDto;
  @IsOptional() @IsBoolean() is_default?: boolean;
}

export class UpdateBrandKitDto {
  @IsOptional() @IsString() @Length(1, 60) name?: string;
  @IsOptional() @IsString() @MaxLength(280) description?: string | null;
  @IsOptional() @IsString() @MaxLength(300) logo_path?: string | null;
  @IsOptional() @IsString() @MaxLength(300) intro_path?: string | null;
  @IsOptional() @IsString() @MaxLength(300) outro_path?: string | null;
  @IsOptional() @IsBoolean() intro_enabled?: boolean;
  @IsOptional() @IsBoolean() outro_enabled?: boolean;
  @IsOptional() @ValidateNested() @Type(() => BrandColorsDto) colors?: BrandColorsDto;
  @IsOptional() @ValidateNested() @Type(() => BrandTypographyDto) typography?: BrandTypographyDto;
  @IsOptional() @ValidateNested() @Type(() => BrandCaptionsDto) captions?: BrandCaptionsDto;
  @IsOptional() @ValidateNested() @Type(() => BrandLogoDto) logo?: BrandLogoDto;
}

export class CreateAssetUploadDto {
  @IsIn(Object.keys(ASSET_KINDS)) kind!: string;
  @IsString() @MaxLength(100) mime_type!: string;
  @IsInt() @Min(1) size!: number;
}
