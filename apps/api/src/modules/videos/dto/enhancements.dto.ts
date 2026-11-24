import 'reflect-metadata';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, Matches, Max, Min, ValidateNested } from 'class-validator';
import { TRANSLATE_LANGUAGES } from '../../../common/enhancements';

const HEX = /^#[0-9a-fA-F]{6}$/;

export class MotionGraphicsDto {
  @IsOptional() @IsBoolean() progress_bar?: boolean;
  @IsOptional() @IsBoolean() keywords?: boolean;
  @IsOptional() @Matches(HEX) color?: string;
}
export class AiEmojisDto {
  @IsOptional() @IsIn(['low', 'medium', 'high']) density?: string;
  @IsOptional() @IsIn(['above', 'corner']) position?: string;
}
export class SpeechCleanupDto {
  @IsOptional() @IsBoolean() pauses?: boolean;
  @IsOptional() @IsBoolean() fillers?: boolean;
  /** Pauses longer than this (seconds) are shortened. */
  @IsOptional() @IsNumber() @Min(0.3) @Max(2) max_pause?: number;
}
export class EnhanceAudioDto {
  @IsOptional() @IsIn(['light', 'strong']) noise?: string;
}
export class AutoSfxDto {
  @IsOptional() @IsIn(['subtle', 'normal', 'bold']) intensity?: string;
  @IsOptional() @IsInt() @Min(10) @Max(100) volume?: number;
}
export class AutoZoomDto {
  @IsOptional() @IsIn(['subtle', 'medium', 'strong']) strength?: string;
}
export class TransitionsDto {
  @IsOptional() @IsIn(['fade', 'slide', 'zoom', 'wipe']) style?: string;
  @IsOptional() @IsNumber() @Min(0.2) @Max(1) duration?: number;
}
export class ColorCorrectionDto {
  @IsOptional() @IsIn(['natural', 'vibrant', 'warm', 'cool']) preset?: string;
}
export class LanguageDto {
  @IsIn([...TRANSLATE_LANGUAGES]) language!: string;
}

/** Enabled enhancements and their settings; a present key means "on". */
export class EnhancementsDto {
  @IsOptional() @ValidateNested() @Type(() => MotionGraphicsDto) motion_graphics?: MotionGraphicsDto;
  @IsOptional() @ValidateNested() @Type(() => AiEmojisDto) ai_emojis?: AiEmojisDto;
  @IsOptional() @ValidateNested() @Type(() => SpeechCleanupDto) speech_cleanup?: SpeechCleanupDto;
  @IsOptional() @ValidateNested() @Type(() => EnhanceAudioDto) enhance_audio?: EnhanceAudioDto;
  @IsOptional() @ValidateNested() @Type(() => AutoSfxDto) auto_sfx?: AutoSfxDto;
  @IsOptional() @ValidateNested() @Type(() => AutoZoomDto) auto_zoom?: AutoZoomDto;
  @IsOptional() @ValidateNested() @Type(() => TransitionsDto) transitions?: TransitionsDto;
  @IsOptional() @ValidateNested() @Type(() => ColorCorrectionDto) color_correction?: ColorCorrectionDto;
  @IsOptional() @ValidateNested() @Type(() => LanguageDto) voice_dubbing?: LanguageDto;
  @IsOptional() @ValidateNested() @Type(() => LanguageDto) caption_translation?: LanguageDto;
  /** Not built yet; rejected if sent. */
  @IsOptional() eye_contact?: unknown;
}
