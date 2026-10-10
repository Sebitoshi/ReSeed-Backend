import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entrepreneur } from './entities/entrepreneur.entity.js';
import { EntrepreneurStatusLog } from './entities/entrepreneur-status-log.entity.js';
import { EntrepreneursService } from './entrepreneurs.service.js';
import { EntrepreneurStatusLogService } from './entrepreneur-status-log.service.js';
import { EntrepreneursController } from './entrepreneurs.controller.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Entrepreneur, EntrepreneurStatusLog]), UsersModule],
  controllers: [EntrepreneursController],
  providers: [EntrepreneursService, EntrepreneurStatusLogService],
  exports: [EntrepreneursService],
})
export class EntrepreneursModule {}
