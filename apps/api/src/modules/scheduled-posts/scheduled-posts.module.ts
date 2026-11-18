import { Module } from '@nestjs/common';
import { PlatformsModule } from '../platforms/platforms.module';
import { ClipsRepository } from '../clips/clips.repository';
import { StorageService } from '../storage/storage.service';
import { ScheduledPostsController } from './scheduled-posts.controller';
import { ScheduledPostsService } from './scheduled-posts.service';

@Module({
  imports: [PlatformsModule],
  providers: [ScheduledPostsService, ClipsRepository, StorageService],
  controllers: [ScheduledPostsController],
})
export class ScheduledPostsModule {}
