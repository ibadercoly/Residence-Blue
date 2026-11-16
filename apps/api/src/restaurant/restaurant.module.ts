import { Module } from '@nestjs/common';
import { CuisineController, RestaurantController } from './restaurant.controller';
import { RestaurantService } from './restaurant.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule],
  controllers: [RestaurantController, CuisineController],
  providers: [RestaurantService],
  exports: [RestaurantService],
})
export class RestaurantModule {}
