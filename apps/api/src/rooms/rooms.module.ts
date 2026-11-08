import { Module } from '@nestjs/common';
import { RoomsController, RoomTypesController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  controllers: [RoomsController, RoomTypesController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
