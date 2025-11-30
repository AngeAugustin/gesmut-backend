import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Put } from '@nestjs/common';
import { DemandesService } from './demandes.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/roles.enum';

@Controller('demandes')
export class DemandesController {
  constructor(private readonly demandesService: DemandesService) {}

  @Post('public')
  createPublic(@Body() createDemandeDto: any) {
    // Créer une demande sans authentification (pour les agents publics)
    return this.demandesService.createPublic(createDemandeDto);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AGENT)
  create(@Body() createDemandeDto: any, @CurrentUser() user: any) {
    // Récupérer l'agentId depuis l'utilisateur
    return this.demandesService.create(createDemandeDto, user.agentId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.demandesService.findAll();
  }

  @Get('mes-demandes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AGENT)
  findMesDemandes(@CurrentUser() user: any) {
    return this.demandesService.findByAgent(user.agentId);
  }

  @Get('responsable/mes-demandes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESPONSABLE)
  findDemandesPourResponsable(@CurrentUser() user: any) {
    // Récupérer le serviceId du responsable depuis l'utilisateur
    console.log('User dans findDemandesPourResponsable:', JSON.stringify(user, null, 2));
    const serviceId = user.serviceId?._id || user.serviceId;
    console.log('ServiceId extrait:', serviceId);
    if (!serviceId) {
      console.warn('Le responsable n\'a pas de serviceId assigné');
      return [];
    }
    return this.demandesService.findByResponsableService(serviceId.toString());
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    // Endpoint public pour permettre le suivi sans authentification
    return this.demandesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AGENT, Role.ADMIN)
  update(@Param('id') id: string, @Body() updateDemandeDto: any) {
    return this.demandesService.update(id, updateDemandeDto);
  }

  @Put(':id/soumettre')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AGENT)
  soumettre(@Param('id') id: string) {
    return this.demandesService.soumettre(id);
  }

  @Post('strategique')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DNCF)
  createStrategique(@Body() createDto: any) {
    return this.demandesService.createMutationStrategique(createDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.demandesService.remove(id);
  }
}

