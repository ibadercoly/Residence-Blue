import { Module } from '@nestjs/common';
import { CuisineController, RestaurantController } from './restaurant.controller';
import { RestaurantService } from './restaurant.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RestaurantController, CuisineController],
  providers: [RestaurantService],
  exports: [RestaurantService],
})
export class RestaurantModule {}
