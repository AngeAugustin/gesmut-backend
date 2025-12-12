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
    // Utiliser le validateurRole fourni par le frontend (spécifie le rôle sous lequel on valide)
    // Si non fourni, utiliser le premier rôle de l'utilisateur
    const userRoles = (user.roles && Array.isArray(user.roles) && user.roles.length > 0)
      ? user.roles
      : (user.role ? [user.role] : []);
    const validateurRole = createValidationDto.validateurRole || userRoles[0] || user.role;
    
    return this.validationsService.create({
      ...createValidationDto,
      validateurId: user.id,
      validateurRole: validateurRole,
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

