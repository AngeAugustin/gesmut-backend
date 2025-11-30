import { Controller, Get, Post, Body, Param, UseGuards, Patch } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findByUser(@CurrentUser() user: any) {
    return this.notificationsService.findByUser(user.id);
  }

  @Get('count')
  countNonLues(@CurrentUser() user: any) {
    return this.notificationsService.countNonLues(user.id);
  }

  @Patch(':id/lu')
  marquerCommeLu(@Param('id') id: string) {
    return this.notificationsService.marquerCommeLu(id);
  }

  @Post()
  create(@Body() createDto: any) {
    return this.notificationsService.create(createDto);
  }
}

