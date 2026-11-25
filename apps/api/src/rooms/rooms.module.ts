import { Module } from '@nestjs/common';
import { RoomsController, RoomTypesController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { RoomProblemsService } from './room-problems.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [RoomsController, RoomTypesController],
  providers: [RoomsService, RoomProblemsService],
  exports: [RoomsService, RoomProblemsService],
})
export class RoomsModule {}
