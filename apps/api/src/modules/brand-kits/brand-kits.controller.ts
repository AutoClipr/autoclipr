import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '../../common/api-response';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser, JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BrandKitsService } from './brand-kits.service';
import { CreateAssetUploadDto, CreateBrandKitDto, UpdateBrandKitDto } from './dto/brand-kit.dto';

@ApiTags('Brand kits')
@ApiBearerAuth('JWT')
@Controller('brand-kits')
@UseGuards(JwtAuthGuard)
export class BrandKitsController {
  constructor(private readonly kits: BrandKitsService) {}

  /** Plan access + limits; open to every plan so the UI can show the upgrade state. */
  @Get('entitlement')
  async entitlement(@CurrentUser() user: AuthUser) {
    return ApiResponse.ok(await this.kits.entitlement(user.sub));
  }

  @Get('presets')
  async presets(@CurrentUser() user: AuthUser) {
    return ApiResponse.ok(await this.kits.presets(user.sub));
  }

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return ApiResponse.ok(await this.kits.list(user.sub));
  }

  @Post('assets')
  async createAssetUpload(@CurrentUser() user: AuthUser, @Body() dto: CreateAssetUploadDto) {
    return ApiResponse.ok(await this.kits.createAssetUpload(user.sub, dto));
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return ApiResponse.ok(await this.kits.get(user.sub, id));
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateBrandKitDto) {
    return ApiResponse.ok(await this.kits.create(user.sub, dto));
  }

  @Patch(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBrandKitDto) {
    return ApiResponse.ok(await this.kits.update(user.sub, id, dto));
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return ApiResponse.ok(await this.kits.remove(user.sub, id));
  }

  @Post(':id/duplicate')
  async duplicate(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return ApiResponse.ok(await this.kits.duplicate(user.sub, id));
  }

  @Post(':id/set-default')
  @HttpCode(200)
  async setDefault(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return ApiResponse.ok(await this.kits.setDefault(user.sub, id));
  }
}
