import * as fs from 'fs';
import * as path from 'path';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import { interval, map, merge, Observable } from 'rxjs';
import { Role } from '@residence-blue/shared';
import { Public, Roles } from '../common/decorators/roles.decorator';
import { RestaurantActorContext, RestaurantService } from './restaurant.service';
import {
  CancelRestaurantOrderDto,
  CreateRestaurantOrderDto,
  CreateRestaurantProductDto,
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
  constructor(private readonly restaurantService: RestaurantService) {}

  private extractActor(req?: Request, idempotencyKey?: string): RestaurantActorContext {
    const user = (req as any)?.user as
      | { id?: string; fullName?: string; role?: string }
      | undefined;
    return {
      idempotencyKey: idempotencyKey?.trim() || undefined,
      userId: user?.id,
      actorName: user?.fullName,
      actorRole: user?.role,
      ip: req?.ip || req?.socket?.remoteAddress || undefined,
    };
  }

  @Get('catalog')
  @Roles(Role.DIRECTION, Role.RECEPTION, Role.RESTAURANT, Role.SERVEUR, Role.COMPTABLE)
  async getCatalog(@Req() req: Request) {
    const role = (req as any)?.user?.role as string | undefined;
    return this.restaurantService.getCatalog(role);
  }

  @Get('categories')
  @Roles(Role.DIRECTION, Role.RECEPTION, Role.RESTAURANT, Role.SERVEUR, Role.COMPTABLE)
  async findAllCategories() {
    return this.restaurantService.findAllCategories();
  }

  @Get('rooms-in-stay')
  @Roles(Role.DIRECTION, Role.RECEPTION, Role.RESTAURANT, Role.SERVEUR, Role.COMPTABLE)
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
  @Roles(Role.DIRECTION, Role.RECEPTION, Role.RESTAURANT, Role.SERVEUR, Role.COMPTABLE)
  async findAllProducts() {
    return this.restaurantService.findAllProducts();
  }

  @Post('products')
  @Roles(Role.DIRECTION)
  async createProduct(@Body() dto: CreateRestaurantProductDto, @Req() req: Request) {
    return this.restaurantService.createProduct(dto, this.extractActor(req));
  }

  @Post('products/:id/image')
  @Roles(Role.DIRECTION)
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
  @Roles(Role.DIRECTION)
  @HttpCode(HttpStatus.OK)
  async deleteProductImage(@Param('id') id: string, @Req() req: Request) {
    return this.restaurantService.removeProductImage(id, this.extractActor(req));
  }

  @Patch('products/:id')
  @Roles(Role.DIRECTION)
  async updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateRestaurantProductDto,
    @Req() req: Request,
  ) {
    return this.restaurantService.updateProduct(id, dto, this.extractActor(req));
  }

  @Delete('products/:id')
  @Roles(Role.DIRECTION)
  @HttpCode(HttpStatus.OK)
  async deleteProduct(@Param('id') id: string, @Req() req: Request) {
    return this.restaurantService.deleteOrArchiveProduct(id, this.extractActor(req));
  }

  @Get('orders/stream')
  @Sse()
  @Roles(
    Role.DIRECTION,
    Role.RECEPTION,
    Role.RESTAURANT,
    Role.SERVEUR,
    Role.CUISINE,
    Role.CUISINIER,
  )
  streamOrders(@Req() req: Request): Observable<MessageEvent> {
    const role = (req as any)?.user?.role as string | undefined;
    const rawLastId =
      (req.headers['last-event-id'] as string | undefined) ||
      (req.query?.lastEventId as string | undefined);
    const lastEventId = rawLastId ? Number(rawLastId) : undefined;

    const updates$ = this.restaurantService
      .getRoleFilteredOrderEventStream(role, lastEventId)
      .pipe(
        map(
          (evt) =>
            ({
              id: String(evt.eventId),
              data: evt,
            }) as MessageEvent,
        ),
      );
    const heartbeat$ = interval(25000).pipe(
      map(
        () =>
          ({
            data: { type: 'HEARTBEAT', timestamp: new Date().toISOString() },
          }) as MessageEvent,
      ),
    );
    return merge(updates$, heartbeat$);
  }

  @Get('orders/stale')
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async findStaleOrders() {
    return this.restaurantService.findStaleOrders();
  }

  @Post('orders/:id/close-stale')
  @Roles(Role.DIRECTION, Role.RECEPTION)
  @HttpCode(HttpStatus.OK)
  async closeStaleOrder(
    @Param('id') id: string,
    @Body() dto: CancelRestaurantOrderDto,
    @Req() req: Request,
  ) {
    return this.restaurantService.closeStaleOrder(id, dto, this.extractActor(req));
  }

  @Get('orders/page')
  @Roles(
    Role.DIRECTION,
    Role.RECEPTION,
    Role.RESTAURANT,
    Role.SERVEUR,
    Role.CUISINE,
    Role.CUISINIER,
    Role.COMPTABLE,
  )
  async findOrdersPage(@Query() query: RestaurantOrdersQueryDto, @Req() req: Request) {
    const role = (req as any)?.user?.role as string | undefined;
    return this.restaurantService.findOrdersPage(query, role);
  }

  @Get('kitchen/orders')
  @Roles(Role.DIRECTION, Role.CUISINE, Role.CUISINIER)
  async findKitchenOrders(@Req() req: Request) {
    const role = (req as any)?.user?.role as string | undefined;
    return this.restaurantService.findAllOrders(role);
  }

  @Get('orders')
  @Roles(Role.DIRECTION, Role.CUISINE, Role.CUISINIER)
  async findAllOrders(@Req() req: Request) {
    const role = (req as any)?.user?.role as string | undefined;
    return this.restaurantService.findAllOrders(role);
  }

  @Post('orders')
  @Roles(Role.DIRECTION, Role.RECEPTION, Role.RESTAURANT, Role.SERVEUR)
  async createOrder(
    @Body() dto: CreateRestaurantOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Req() req?: Request,
  ) {
    return this.restaurantService.createOrder(dto, this.extractActor(req, idempotencyKey));
  }

  @Post('orders/:id/pay')
  @Roles(Role.DIRECTION, Role.RECEPTION, Role.RESTAURANT, Role.SERVEUR)
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
  @Roles(Role.DIRECTION, Role.RECEPTION)
  @HttpCode(HttpStatus.OK)
  async cancelOrder(
    @Param('id') id: string,
    @Body() dto: CancelRestaurantOrderDto,
    @Req() req: Request,
  ) {
    return this.restaurantService.cancelOrder(id, dto, this.extractActor(req));
  }

  @Patch('orders/:id/status')
  @Roles(
    Role.DIRECTION,
    Role.RECEPTION,
    Role.RESTAURANT,
    Role.SERVEUR,
    Role.CUISINE,
    Role.CUISINIER,
  )
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRestaurantOrderDto,
    @Req() req: Request,
  ) {
    return this.restaurantService.updateOrder(id, dto, this.extractActor(req));
  }

  @Patch('orders/:id')
  @Roles(
    Role.DIRECTION,
    Role.RECEPTION,
    Role.RESTAURANT,
    Role.SERVEUR,
    Role.CUISINE,
    Role.CUISINIER,
  )
  async updateOrder(
    @Param('id') id: string,
    @Body() dto: UpdateRestaurantOrderDto,
    @Req() req: Request,
  ) {
    return this.restaurantService.updateOrder(id, dto, this.extractActor(req));
  }
}
