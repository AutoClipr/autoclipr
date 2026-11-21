import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StorageService } from '../storage/storage.service';
import { UsersModule } from '../users/users.module';
import { BrandKitsController } from './brand-kits.controller';
import { BrandKitsRepository } from './brand-kits.repository';
import { BrandKitsService } from './brand-kits.service';

@Module({
  imports: [UsersModule],
  providers: [BrandKitsRepository, BrandKitsService, StorageService, JwtAuthGuard],
  controllers: [BrandKitsController],
  exports: [BrandKitsService],
})
export class BrandKitsModule {}
