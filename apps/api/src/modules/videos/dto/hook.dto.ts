import 'reflect-metadata';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { HOOK_FONTS, HOOK_TEMPLATE_IDS } from '../../../common/hook-templates';

const HEX = /^#[0-9a-fA-F]{6}$/;

/** AI Hook & Headline settings for a generation job. */
export class HookDto {
  @IsIn(['viral', 'headline'])
  kind!: 'viral' | 'headline';

  @IsIn(HOOK_TEMPLATE_IDS)
  template_id!: string;

  /** opening: added before the clip. overlay: drawn over the clip's first seconds. */
  @IsOptional() @IsIn(['opening', 'overlay']) placement?: 'opening' | 'overlay';
  @IsOptional() @IsNumber() @Min(1) @Max(5) duration?: number;
  /** Custom text for every clip; omitted = AI writes one per clip. */
  @IsOptional() @IsString() @MaxLength(80) text?: string;
  @IsOptional() @IsBoolean() sfx?: boolean;

  // Headline customisation (ignored for viral hooks, which have a fixed look).
  @IsOptional() @IsIn([...HOOK_FONTS]) font?: string;
  @IsOptional() @IsInt() @Min(40) @Max(160) size?: number;
  @IsOptional() @Matches(HEX) color?: string;
  @IsOptional() @Matches(HEX) bg_color?: string;
  @IsOptional() @IsIn(['top', 'middle', 'bottom']) position?: string;
  @IsOptional() @IsIn(['none', 'fade', 'pop', 'slide', 'typewriter']) animation?: string;
  @IsOptional() @IsIn(['none', 'box', 'pill']) background?: string;
  /** Use the selected brand kit's colours and caption font. */
  @IsOptional() @IsBoolean() use_brand?: boolean;
}
