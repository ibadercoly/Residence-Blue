import { Module } from '@nestjs/common';
import { RoomsController, RoomTypesController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [RoomsController, RoomTypesController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
