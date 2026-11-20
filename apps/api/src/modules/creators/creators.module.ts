import { Module } from '@nestjs/common';
import { CreatorsController } from './creators.controller';
import { CreatorsRepository } from './creators.repository';
import { CreatorsService } from './creators.service';

@Module({
  providers: [CreatorsRepository, CreatorsService],
  controllers: [CreatorsController],
})
export class CreatorsModule {}
