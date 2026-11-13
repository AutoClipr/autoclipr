import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

/** Plans a coupon can be limited to. The free Starter plan has nothing to discount. */
export const COUPON_PLANS = ['creator', 'business'] as const;

/** Trim and lowercase plan names, so "Creator " still means creator. */
const normalizePlans = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? value.map((p) => (typeof p === 'string' ? p.trim().toLowerCase() : p))
    : value;

export class CreateCouponDto {
  /** Capped at 16 characters because Dodo's discount codes are. */
  @IsString()
  @Length(3, 16)
  code!: string;

  @IsIn(['percentage', 'free_trial', 'free_credits'])
  type!: 'percentage' | 'free_trial' | 'free_credits';

  /** Percent for percentage, days for free_trial, credits for free_credits. */
  @IsInt()
  @Min(1)
  value!: number;

  @IsOptional()
  @IsIn(['draft', 'active', 'paused'])
  status?: 'draft' | 'active' | 'paused';

  @IsOptional()
  @IsISO8601()
  starts_at?: string;

  @IsOptional()
  @IsISO8601()
  expires_at?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  max_uses?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  max_uses_per_user?: number;

  /** Empty or omitted means the coupon applies to every plan. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @Transform(normalizePlans)
  @IsIn(COUPON_PLANS, {
    each: true,
    message: `applicable_plans must only contain: ${COUPON_PLANS.join(', ')}`,
  })
  applicable_plans?: string[];

  @IsOptional()
  @IsIn(['public', 'private'])
  visibility?: 'public' | 'private';

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;
}

export class UpdateCouponStatusDto {
  /**
   * 'exhausted' is not settable by hand — it is a consequence of the usage
   * cap being reached, applied by the redemption function.
   */
  @IsIn(['draft', 'active', 'paused', 'expired'])
  status!: 'draft' | 'active' | 'paused' | 'expired';
}

export class ValidateCouponDto {
  @IsString()
  @Length(3, 16)
  code!: string;

  /**
   * Optional: the pricing page checks a code before a plan is chosen, and
   * shows the discount per plan from `applicablePlans`. Checkout always
   * re-validates against the plan actually being bought.
   */
  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsIn(['monthly', 'yearly'])
  billingPeriod?: 'monthly' | 'yearly';
}

/**
 * Every field optional — this is a partial edit. `code` and `type` are absent
 * on purpose: the code is the coupon's identity on both our side and Dodo's,
 * and the type decides whether a Dodo mirror exists at all.
 */
export class UpdateCouponDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  value?: number;

  @IsOptional()
  @IsISO8601()
  starts_at?: string;

  @IsOptional()
  @IsISO8601()
  expires_at?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  max_uses?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  max_uses_per_user?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @Transform(normalizePlans)
  @IsIn(COUPON_PLANS, {
    each: true,
    message: `applicable_plans must only contain: ${COUPON_PLANS.join(', ')}`,
  })
  applicable_plans?: string[];

  @IsOptional()
  @IsIn(['public', 'private'])
  visibility?: 'public' | 'private';

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @IsOptional()
  @IsIn(['draft', 'active', 'paused', 'expired'])
  status?: 'draft' | 'active' | 'paused' | 'expired';
}

export class GenerateCodesDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  count?: number;

  /** Prepended to each code, e.g. "CREATOR" -> CREATOR-7XK92P. */
  @IsOptional()
  @IsString()
  @Length(1, 9)
  prefix?: string;
}
