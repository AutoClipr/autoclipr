import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCouponDto, UpdateCouponDto } from './coupon.dto';

/** Runs the same transform + validation the global ValidationPipe does. */
async function check<T extends object>(cls: new () => T, body: object) {
  const dto = plainToInstance(cls, body);
  const errors = await validate(dto, { whitelist: true });
  return { dto, errors };
}

const base = { code: 'TEST20', type: 'percentage', value: 20 };

describe('coupon DTO applicable_plans', () => {
  it('normalizes case and whitespace', async () => {
    const { dto, errors } = await check(CreateCouponDto, {
      ...base,
      applicable_plans: [' Creator ', 'BUSINESS'],
    });

    expect(errors).toHaveLength(0);
    expect(dto.applicable_plans).toEqual(['creator', 'business']);
  });

  it('accepts an empty list, which means every plan', async () => {
    const { errors } = await check(CreateCouponDto, { ...base, applicable_plans: [] });
    expect(errors).toHaveLength(0);
  });

  it.each([['buisness'], ['starter'], ['enterprise']])('rejects the unknown plan %s', async (plan) => {
    const { errors } = await check(CreateCouponDto, { ...base, applicable_plans: ['creator', plan] });

    expect(errors).toHaveLength(1);
    expect(Object.values(errors[0].constraints ?? {})).toContain(
      'applicable_plans must only contain: creator, pro, business',
    );
  });

  it('applies the same rules when editing', async () => {
    const ok = await check(UpdateCouponDto, { applicable_plans: ['Creator'] });
    expect(ok.errors).toHaveLength(0);
    expect(ok.dto.applicable_plans).toEqual(['creator']);

    const bad = await check(UpdateCouponDto, { applicable_plans: ['Buisness'] });
    expect(bad.errors).toHaveLength(1);
  });
});
