import { Module } from '@nestjs/common';
import { TechniqueController } from './technique.controller';
import { TechniqueService } from './technique.service';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [RoomsModule],
  controllers: [TechniqueController],
  providers: [TechniqueService],
  exports: [TechniqueService],
})
export class TechniqueModule {}
