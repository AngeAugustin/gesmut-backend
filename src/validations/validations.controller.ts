import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ValidationsService } from './validations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/roles.enum';

@Controller('validations')
@UseGuards(JwtAuthGuard)
export class ValidationsController {
  constructor(private readonly validationsService: ValidationsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.RESPONSABLE, Role.DGR, Role.CVR, Role.DNCF)
  create(@Body() createValidationDto: any, @CurrentUser() user: any) {
    return this.validationsService.create({
      ...createValidationDto,
      validateurId: user.id,
      validateurRole: user.role,
    });
  }

  @Get()
  findAll() {
    return this.validationsService.findAll();
  }

  @Get('demande/:demandeId')
  findByDemande(@Param('demandeId') demandeId: string) {
    return this.validationsService.findByDemande(demandeId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.validationsService.findOne(id);
  }
}

