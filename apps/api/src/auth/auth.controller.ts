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
import { AuthService } from './auth.service';
import { CreateUserDto, LoginDto, UpdateUserDto } from './dto/auth.dto';
import { Public, Roles } from '../common/decorators/roles.decorator';
import { Role } from '@residence-blue/shared';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('auth/login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('users')
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async findAllUsers() {
    return this.authService.findAllUsers();
  }

  @Get('users/:id')
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async findOneUser(@Param('id') id: string) {
    return this.authService.findOneUser(id);
  }

  @Post('users')
  @Roles(Role.DIRECTION)
  async createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto);
  }

  @Patch('users/:id')
  @Roles(Role.DIRECTION)
  async updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.authService.updateUser(id, dto);
  }

  @Delete('users/:id')
  @Roles(Role.DIRECTION)
  @HttpCode(HttpStatus.OK)
  async deleteUser(@Param('id') id: string) {
    return this.authService.deleteOrDeactivateUser(id);
  }
}
