import { Controller, ForbiddenException, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { THROTTLE } from '../../config/throttle.config';
import { ApiResponse } from '../../common/api-response';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard, AuthUser } from '../../common/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { UsersRepository } from '../users/users.repository';
import { planFor } from '../../common/plans';

export const ANALYTICS_UPGRADE_MESSAGE = 'Analytics is available on the Creator, Pro and Business plans. Upgrade to track your published clips.';

@ApiTags('Analytics')
@ApiBearerAuth('JWT')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly usersRepo: UsersRepository,
  ) {}

  /** Plan gate, resolved from the profile tier on every request. */
  private async assertAnalyticsPlan(userId: string) {
    const profile = await this.usersRepo.getById(userId);
    if (!planFor(profile?.subscription_tier).analytics) {
      throw new ForbiddenException(ANALYTICS_UPGRADE_MESSAGE);
    }
  }

  @Get()
  async overview(@CurrentUser() user: AuthUser) {
    await this.assertAnalyticsPlan(user.sub);
    const data = await this.analyticsService.getOverview(user.sub, false);
    return ApiResponse.ok(data);
  }

  @Throttle({
    default: {
      limit: THROTTLE.analyticsRefresh.limit,
      ttl: THROTTLE.analyticsRefresh.ttl,
    },
  })
  @Post('refresh')
  async refresh(@CurrentUser() user: AuthUser) {
    await this.assertAnalyticsPlan(user.sub);
    await this.analyticsService.refreshMetrics(user.sub);
    const data = await this.analyticsService.getOverview(user.sub, false);
    return ApiResponse.ok(data);
  }
}
