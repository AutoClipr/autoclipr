import { HOOK_TEMPLATES, hookAllowed, hookTemplate } from './hook-templates';
import { PLANS } from './plans';

describe('hook templates', () => {
  it('has the 19 viral hooks and 4 headlines with unique ids', () => {
    expect(HOOK_TEMPLATES.filter((t) => t.kind === 'viral')).toHaveLength(19);
    expect(HOOK_TEMPLATES.filter((t) => t.kind === 'headline').map((t) => t.name)).toEqual(['Editorial', 'Statement', 'Sunset', 'Classic']);
    expect(new Set(HOOK_TEMPLATES.map((t) => t.id)).size).toBe(HOOK_TEMPLATES.length);
  });

  it('prices viral hooks at 2 and headlines at 1 credit per clip', () => {
    expect(hookTemplate('halo')!.credits).toBe(2);
    expect(hookTemplate('classic')!.credits).toBe(1);
    expect(hookTemplate('nope')).toBeUndefined();
  });

  it('gates templates by plan access', () => {
    const basic = hookTemplate('halo')!;
    const premium = hookTemplate('neon')!;
    expect(hookAllowed(PLANS.starter.hookAccess, basic)).toBe(false);
    expect(hookAllowed(PLANS.creator.hookAccess, basic)).toBe(true);
    expect(hookAllowed(PLANS.creator.hookAccess, premium)).toBe(false);
    expect(hookAllowed(PLANS.pro.hookAccess, premium)).toBe(true);
    expect(hookAllowed(PLANS.business.hookAccess, premium)).toBe(true);
  });
});
