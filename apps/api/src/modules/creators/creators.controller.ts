import { Controller, Get, Header, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { THROTTLE } from '../../config/throttle.config';
import { ApiResponse } from '../../common/api-response';
import { Public } from '../../common/decorators/public.decorator';
import { CREATOR_SORTS, CreatorSort, CreatorsService } from './creators.service';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

const toInt = (v: string | undefined, fallback: number) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

@ApiTags('Creators')
@Controller('creators')
export class CreatorsController {
  constructor(private readonly creators: CreatorsService) {}

  /** Public Top Creators leaderboard, served from cached stats. */
  @Public()
  @Throttle({ default: { limit: THROTTLE.public.limit, ttl: THROTTLE.public.ttl } })
  @Header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600')
  @Get()
  async leaderboard(
    @Query('sort') sort?: string,
    @Query('category') category?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const data = await this.creators.leaderboard({
      sort: (CREATOR_SORTS as readonly string[]).includes(sort ?? '') ? (sort as CreatorSort) : 'rank',
      category: category && category.toLowerCase() !== 'all' ? category.slice(0, 40) : undefined,
      q: q?.slice(0, 100),
      page: toInt(page, 1),
      pageSize: Math.min(toInt(pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE),
    });
    return ApiResponse.ok(data);
  }
}
