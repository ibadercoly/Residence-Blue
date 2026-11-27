import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  Patch,
  Req,
  Sse,
} from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@residence-blue/shared';
import { TechniqueService } from './technique.service';
import { ResolveRoomProblemDto } from '../rooms/dto/resolve-room-problem.dto';
import { map, merge, Observable, timer } from 'rxjs';

@Controller('technique')
@Roles(Role.MAINTENANCE, Role.DIRECTION)
export class TechniqueController {
  constructor(private readonly techniqueService: TechniqueService) {}

  /**
   * Tableau de bord Technique : problèmes groupés (À traiter, En cours, Réparés aujourd'hui).
   * Strictement réservé au rôle MAINTENANCE. Aucun prix ni nom client.
   */
  @Get('problems')
  async getDashboard() {
    return this.techniqueService.getDashboard();
  }

  /**
   * Prise en charge d'un problème par le technicien (« Je m'en occupe »).
   */
  @Patch('problems/:id/take')
  async takeProblem(@Param('id') id: string, @Req() req: Request) {
    const user = (req as any).user;
    const ip = req.ip || req.socket.remoteAddress || undefined;
    return this.techniqueService.takeProblem(id, user, ip);
  }

  /**
   * Résolution d'un problème technique (« C'est réparé »).
   */
  @Patch('problems/:id/resolve')
  async resolveProblem(
    @Param('id') id: string,
    @Body() dto: ResolveRoomProblemDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    const ip = req.ip || req.socket.remoteAddress || undefined;
    return this.techniqueService.resolveProblem(id, dto, user, ip);
  }

  /**
   * Autorisation préalable d'intervention par le directeur pour une panne majeure.
   */
  @Patch('problems/:id/approve')
  @Roles(Role.DIRECTION)
  async approveProblem(@Param('id') id: string, @Req() req: Request) {
    const user = (req as any).user;
    const ip = req.ip || req.socket.remoteAddress || undefined;
    return this.techniqueService.approveProblem(id, user, ip);
  }

  /**
   * Flux SSE temps réel pour l'écran Technique.
   * Filtre strict : ne diffuse aucune donnée client ni tarif.
   */
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    const heartbeat$ = timer(0, 15000).pipe(
      map(() => ({
        data: JSON.stringify({
          type: 'HEARTBEAT',
          timestamp: new Date().toISOString(),
        }),
      })),
    );

    const events$ = this.techniqueService.getStream().pipe(
      map((event) => ({
        data: JSON.stringify(event),
      })),
    );

    return merge(events$, heartbeat$);
  }
}
