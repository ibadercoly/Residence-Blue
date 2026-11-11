import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { RestaurantService } from './restaurant.service';
import {
  CreateRestaurantOrderDto,
  CreateRestaurantProductDto,
  UpdateRestaurantOrderDto,
  UpdateRestaurantProductDto,
} from './dto/restaurant.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@residence-blue/shared';

@Controller('restaurant')
export class RestaurantController {
  constructor(private readonly restaurantService: RestaurantService) {}

  @Get('categories')
  @Roles(Role.DIRECTION, Role.RECEPTION, Role.RESTAURANT, Role.SERVEUR, Role.CUISINE)
  async findAllCategories() {
    return this.restaurantService.findAllCategories();
  }

  @Get('products')
  @Roles(Role.DIRECTION, Role.RECEPTION, Role.RESTAURANT, Role.SERVEUR, Role.CUISINE)
  async findAllProducts() {
    return this.restaurantService.findAllProducts();
  }

  @Post('products')
  @Roles(Role.DIRECTION, Role.RESTAURANT)
  async createProduct(@Body() dto: CreateRestaurantProductDto) {
    return this.restaurantService.createProduct(dto);
  }

  @Patch('products/:id')
  @Roles(Role.DIRECTION, Role.RESTAURANT)
  async updateProduct(@Param('id') id: string, @Body() dto: UpdateRestaurantProductDto) {
    return this.restaurantService.updateProduct(id, dto);
  }

  @Delete('products/:id')
  @Roles(Role.DIRECTION, Role.RESTAURANT)
  @HttpCode(HttpStatus.OK)
  async deleteProduct(@Param('id') id: string) {
    return this.restaurantService.deleteOrArchiveProduct(id);
  }

  @Get('orders')
  @Roles(Role.DIRECTION, Role.RECEPTION, Role.RESTAURANT, Role.SERVEUR, Role.CUISINE)
  async findAllOrders() {
    return this.restaurantService.findAllOrders();
  }

  @Post('orders')
  @Roles(Role.DIRECTION, Role.RECEPTION, Role.RESTAURANT, Role.SERVEUR)
  async createOrder(@Body() dto: CreateRestaurantOrderDto) {
    return this.restaurantService.createOrder(dto);
  }

  @Patch('orders/:id')
  @Roles(Role.DIRECTION, Role.RECEPTION, Role.RESTAURANT, Role.SERVEUR, Role.CUISINE)
  async updateOrder(@Param('id') id: string, @Body() dto: UpdateRestaurantOrderDto) {
    return this.restaurantService.updateOrder(id, dto);
  }
}
