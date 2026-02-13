import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { EventsController } from './events.controller';

@Module({
  imports: [PrismaModule],
  controllers: [EventsController],
})
export class EventsModule {}
