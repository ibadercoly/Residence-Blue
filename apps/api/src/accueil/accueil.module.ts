import { Module } from '@nestjs/common';
import { AccueilController } from './accueil.controller';
import { AccueilService } from './accueil.service';

@Module({
  controllers: [AccueilController],
  providers: [AccueilService],
  exports: [AccueilService],
})
export class AccueilModule {}
