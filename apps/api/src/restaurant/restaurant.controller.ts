import * as fs from 'fs';
import * as path from 'path';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  MessageEvent,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  Sse,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { map, merge, Observable, takeUntil, timer } from 'rxjs';
import { hasScreenAccess, hasSpecialPermission, isKitchenAccount } from '@residence-blue/shared';
import { Acces } from '../common/decorators/acces.decorator';
import { Public } from '../common/decorators/roles.decorator';
import { SessionRevocationService } from '../auth/session-revocation.service';
import { RestaurantActorContext, RestaurantService } from './restaurant.service';
import {
  CancelRestaurantOrderDto,
  CreateRestaurantOrderDto,
  CreateRestaurantProductDto,
  ModifyRestaurantOrderItemsDto,
  PayRestaurantOrderDto,
  RestaurantOrdersQueryDto,
  UpdateRestaurantOrderDto,
  UpdateRestaurantProductDto,
} from './dto/restaurant.dto';
import {
  getRestaurantUploadsDir,
  MAX_PRODUCT_IMAGE_SIZE_BYTES,
  UploadedProductImageFile,
} from './restaurant-image.util';

@Controller('restaurant')
export class RestaurantController {
  constructor(
    private readonly restaurantService: RestaurantService,
    private readonly sessionRevocation: SessionRevocationService,
  ) {}

  private getAccessFlags(req?: Request) {
    const user = (req as any)?.user;
    const role = user?.role as string | undefined;
    const isKitchenOnly = isKitchenAccount(user);
    const hideAmounts = isKitchenOnly || !hasSpecialPermission(user, 'voir_montants');
    return { user, role, isKitchenOnly, hideAmounts };
  }

  private extractActor(req?: Request, idempotencyKey?: string): RestaurantActorContext {
    const { user, isKitchenOnly, hideAmounts } = this.getAccessFlags(req);
    return {
      idempotencyKey: idempotencyKey?.trim() || undefined,
      userId: user?.id,
      actorName: user?.fullName,
      actorRole: user?.role,
      hideAmounts,
      kitchenOnly: isKitchenOnly,
      ip: req?.ip || req?.socket?.remoteAddress || undefined,
    };
  }

  @Get('catalog')
  @Acces({ anyScreens: [{ screen: 'restaurant', level: 'LECTURE' }, { screen: 'rapports', level: 'LECTURE' }] })
  async getCatalog(@Req() req: Request) {
    const { role, isKitchenOnly, hideAmounts } = this.getAccessFlags(req);
    return this.restaurantService.getCatalog(role, { hideAmounts, kitchenOnly: isKitchenOnly });
  }

  @Get('categories')
  @Acces({ anyScreens: [{ screen: 'restaurant', level: 'LECTURE' }, { screen: 'rapports', level: 'LECTURE' }] })
  async findAllCategories() {
    return this.restaurantService.findAllCategories();
  }

  @Get('rooms-in-stay')
  @Acces('restaurant', 'LECTURE')
  async findRoomsInStay() {
    return this.restaurantService.findRoomsInStay();
  }

  @Get('products/images/:filename')
  @Public()
  serveProductImage(@Param('filename') filename: string, @Res() res: Response) {
    if (!/^[0-9a-fA-F-]{36}(-200)?\.webp$/.test(filename)) {
      throw new NotFoundException('Image produit introuvable.');
    }
    const dir = getRestaurantUploadsDir();
    const fullPath = path.join(dir, filename);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('Image produit introuvable.');
    }
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(fullPath);
  }

  @Get('products')
  @Acces({ anyScreens: [{ screen: 'restaurant', level: 'LECTURE' }, { screen: 'rapports', level: 'LECTURE' }] })
  async findAllProducts(@Req() req: Request) {
    const { hideAmounts } = this.getAccessFlags(req);
    return this.restaurantService.findAllProducts(true, hideAmounts);
  }

  @Post('products')
  @Acces({ directorOnly: true })
  async createProduct(@Body() dto: CreateRestaurantProductDto, @Req() req: Request) {
    return this.restaurantService.createProduct(dto, this.extractActor(req));
  }

  @Post('products/:id/image')
  @Acces({ directorOnly: true })
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: MAX_PRODUCT_IMAGE_SIZE_BYTES } }),
  )
  async uploadProductImage(
    @Param('id') id: string,
    @UploadedFile() file: UploadedProductImageFile | undefined,
    @Req() req: Request,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Aucun fichier image transmis (champ "image" requis).');
    }
    return this.restaurantService.uploadProductImage(id, file.buffer, this.extractActor(req));
  }

  @Delete('products/:id/image')
  @Acces({ directorOnly: true })
  @HttpCode(HttpStatus.OK)
  async deleteProductImage(@Param('id') id: string, @Req() req: Request) {
    return this.restaurantService.removeProductImage(id, this.extractActor(req));
  }

  @Patch('products/:id')
  @Acces({ directorOnly: true })
  async updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateRestaurantProductDto,
    @Req() req: Request,
  ) {
    return this.restaurantService.updateProduct(id, dto, this.extractActor(req));
  }

  @Delete('products/:id')
  @Acces({ directorOnly: true })
  @HttpCode(HttpStatus.OK)
  async deleteProduct(@Param('id') id: string, @Req() req: Request) {
    return this.restaurantService.deleteOrArchiveProduct(id, this.extractActor(req));
  }

  @Get('orders/stream')
  @Sse()
  @Acces('restaurant', 'LECTURE')
  streamOrders(@Req() req: Request): Observable<MessageEvent> {
    const { user, role, isKitchenOnly, hideAmounts } = this.getAccessFlags(req);
    const rawLastId =
      (req.headers['last-event-id'] as string | undefined) ||
      (req.query?.lastEventId as string | undefined);
    const lastEventId = rawLastId ? Number(rawLastId) : undefined;

    const updates$ = this.restaurantService
      .getRoleFilteredOrderEventStream(role, lastEventId, hideAmounts || isKitchenOnly)
      .pipe(
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

  @Get('orders/stale')
  @Acces('restaurant', 'ECRITURE')
  async findStaleOrders() {
    return this.restaurantService.findStaleOrders();
  }

  @Post('orders/:id/close-stale')
  @Acces('restaurant', 'ECRITURE')
  @HttpCode(HttpStatus.OK)
  async closeStaleOrder(
    @Param('id') id: string,
    @Body() dto: CancelRestaurantOrderDto,
    @Req() req: Request,
  ) {
    return this.restaurantService.closeStaleOrder(id, dto, this.extractActor(req));
  }

  @Get('orders/page')
  @Acces({
    anyScreens: [
      { screen: 'restaurant', level: 'LECTURE' },
      { screen: 'facturation', level: 'LECTURE' },
    ],
  })
  async findOrdersPage(@Query() query: RestaurantOrdersQueryDto, @Req() req: Request) {
    const { role, isKitchenOnly, hideAmounts } = this.getAccessFlags(req);
    return this.restaurantService.findOrdersPage(query, role, hideAmounts || isKitchenOnly);
  }

  @Get('kitchen/orders')
  @Acces('cuisine', 'LECTURE')
  async findKitchenOrders(@Req() req: Request) {
    const { user, role } = this.getAccessFlags(req);
    if (!isKitchenAccount(user)) {
      throw new ForbiddenException('Cet écran est réservé au cuisinier');
    }
    return this.restaurantService.findAllOrders(role, true);
  }

  @Get('orders')
  @Acces('cuisine', 'LECTURE')
  async findAllOrders(@Req() req: Request) {
    const { user, role } = this.getAccessFlags(req);
    if (!isKitchenAccount(user)) {
      throw new ForbiddenException('Cet écran est réservé au cuisinier');
    }
    return this.restaurantService.findAllOrders(role, true);
  }

  @Post('orders')
  @Acces('restaurant', 'ECRITURE')
  async createOrder(
    @Body() dto: CreateRestaurantOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Req() req?: Request,
  ) {
    return this.restaurantService.createOrder(dto, this.extractActor(req, idempotencyKey));
  }

  @Post('orders/:id/pay')
  @Acces({ screen: 'restaurant', level: 'ECRITURE', specialPermission: 'encaisser_paiement' })
  @HttpCode(HttpStatus.OK)
  async payOrder(
    @Param('id') id: string,
    @Body() dto: PayRestaurantOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Req() req?: Request,
  ) {
    return this.restaurantService.payExistingOrder(id, dto, this.extractActor(req, idempotencyKey));
  }

  @Post('orders/:id/cancel')
  @Acces({ screen: 'restaurant', level: 'ECRITURE', specialPermission: 'annuler_commande_ou_reservation' })
  @HttpCode(HttpStatus.OK)
  async cancelOrder(
    @Param('id') id: string,
    @Body() dto: CancelRestaurantOrderDto,
    @Req() req: Request,
  ) {
    return this.restaurantService.cancelOrder(id, dto, this.extractActor(req));
  }

  @Patch('orders/:id/items')
  @Acces('restaurant', 'ECRITURE')
  async modifyOrderItems(
    @Param('id') id: string,
    @Body() dto: ModifyRestaurantOrderItemsDto,
    @Req() req: Request,
  ) {
    return this.restaurantService.modifyOrderItems(id, dto, this.extractActor(req));
  }

  @Patch('orders/:id/status')
  @Acces({ anyScreens: [{ screen: 'cuisine', level: 'ECRITURE' }, { screen: 'restaurant', level: 'ECRITURE' }] })
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRestaurantOrderDto,
    @Req() req: Request,
  ) {
    return this.restaurantService.updateOrder(id, dto, this.extractActor(req));
  }

  @Patch('orders/:id')
  @Acces({ anyScreens: [{ screen: 'cuisine', level: 'ECRITURE' }, { screen: 'restaurant', level: 'ECRITURE' }] })
  async updateOrder(
    @Param('id') id: string,
    @Body() dto: UpdateRestaurantOrderDto,
    @Req() req: Request,
  ) {
    return this.restaurantService.updateOrder(id, dto, this.extractActor(req));
  }
}

@Controller('cuisine')
export class CuisineController {
  constructor(
    private readonly restaurantService: RestaurantService,
    private readonly sessionRevocation: SessionRevocationService,
  ) {}

  @Get('stream')
  @Sse()
  @Acces('cuisine', 'LECTURE')
  streamCuisineOrders(@Req() req: Request): Observable<MessageEvent> {
    const user = (req as any)?.user;
    if (!isKitchenAccount(user)) {
      throw new ForbiddenException('Cet écran est réservé au cuisinier');
    }
    const role = user?.role as string | undefined;
    const rawLastId =
      (req.headers['last-event-id'] as string | undefined) ||
      (req.query?.lastEventId as string | undefined);
    const lastEventId = rawLastId ? Number(rawLastId) : undefined;

    const updates$ = this.restaurantService
      .getRoleFilteredOrderEventStream(role, lastEventId, true)
      .pipe(
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

  @Get('orders')
  @Acces('cuisine', 'LECTURE')
  async findCuisineOrders(@Req() req: Request) {
    const user = (req as any)?.user;
    if (!isKitchenAccount(user)) {
      throw new ForbiddenException('Cet écran est réservé au cuisinier');
    }
    return this.restaurantService.findAllOrders(user?.role, true);
  }

  @Get('*')
  @Acces('cuisine', 'LECTURE')
  async findCuisineRoot(@Req() req: Request) {
    const user = (req as any)?.user;
    if (!isKitchenAccount(user)) {
      throw new ForbiddenException('Cet écran est réservé au cuisinier');
    }
    return this.restaurantService.findAllOrders(user?.role, true);
  }
}
