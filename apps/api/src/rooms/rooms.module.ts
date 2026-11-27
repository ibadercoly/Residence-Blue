import { Module } from '@nestjs/common';
import { RoomsController, RoomTypesController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { RoomInterventionsService } from './room-interventions.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [RoomsController, RoomTypesController],
  providers: [RoomsService, RoomInterventionsService],
  exports: [RoomsService, RoomInterventionsService],
})
export class RoomsModule {}
