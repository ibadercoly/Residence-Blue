import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Sse,
} from '@nestjs/common';
import { Request } from 'express';
import { map, merge, Observable, takeUntil, timer } from 'rxjs';
import { Acces } from '../common/decorators/acces.decorator';
import { SessionRevocationService } from '../auth/session-revocation.service';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly sessionRevocation: SessionRevocationService,
  ) {}

  @Get()
  @Acces('restaurant', 'LECTURE')
  async list(@Req() req: Request) {
    return this.notificationsService.listForUser((req as any)?.user);
  }

  @Get('stream')
  @Sse()
  @Acces('restaurant', 'LECTURE')
  stream(@Req() req: Request): Observable<MessageEvent> {
    const user = (req as any)?.user;
    const rawLastId =
      (req.headers['last-event-id'] as string | undefined) ||
      (req.query?.lastEventId as string | undefined);
    const lastEventId = rawLastId ? Number(rawLastId) : undefined;

    const updates$ = this.notificationsService.getUserStream(user, lastEventId).pipe(
      map(
        (evt) =>
          ({
            id: String(evt.eventId),
            data: evt,
          }) as MessageEvent,
      ),
    );
    const heartbeat$ = timer(0, 25000).pipe(
      map(
        () =>
          ({
            data: { type: 'HEARTBEAT', timestamp: new Date().toISOString() },
          }) as MessageEvent,
      ),
    );
    const stream$ = merge(updates$, heartbeat$);
    return user?.id
      ? stream$.pipe(takeUntil(this.sessionRevocation.onUserRevoked(user.id)))
      : stream$;
  }

  @Post('read-all')
  @Acces('restaurant', 'LECTURE')
  @HttpCode(HttpStatus.OK)
  async markAllRead(@Req() req: Request) {
    return this.notificationsService.markAllRead((req as any)?.user);
  }

  @Post(':id/read')
  @Acces('restaurant', 'LECTURE')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ) {
    return this.notificationsService.markRead(id, (req as any)?.user);
  }
}
