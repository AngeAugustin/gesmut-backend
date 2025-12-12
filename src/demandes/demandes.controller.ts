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
  @Roles(Role.AGENT, Role.DGR, Role.CVR)
  create(@Body() createDemandeDto: any, @CurrentUser() user: any) {
    // IMPORTANT: Le rôle doit être celui de l'utilisateur connecté (qui crée la demande),
    // pas celui de l'agent pour qui la demande est créée
    // Gérer les rôles multiples : utiliser le premier rôle
    const userRoles = (user.roles && Array.isArray(user.roles) && user.roles.length > 0)
      ? user.roles
      : (user.role ? [user.role] : []);
    const userRole = userRoles[0] || user.role;
    // L'agentId peut être celui de l'utilisateur connecté OU celui trouvé par matricule/NPI/IFU
    // Mais le rôle doit TOUJOURS être celui de l'utilisateur connecté
    const userAgentId = user.agentId || (user as any).agentId;
    console.log('🔍 [CONTROLLER] Création de demande - User complet:', JSON.stringify(user, null, 2));
    console.log('🔍 [CONTROLLER] Rôle de l\'utilisateur connecté:', userRole, 'Type:', typeof userRole);
    console.log('🔍 [CONTROLLER] AgentId de l\'utilisateur connecté:', userAgentId);
    // Passer le rôle de l'utilisateur connecté, pas celui de l'agent de la demande
    return this.demandesService.create(createDemandeDto, userAgentId, userRole);
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
  @Roles(Role.AGENT, Role.DGR, Role.CVR)
  soumettre(@Param('id') id: string, @CurrentUser() user: any) {
    // Gérer les rôles multiples : utiliser le premier rôle
    const userRoles = (user.roles && Array.isArray(user.roles) && user.roles.length > 0)
      ? user.roles
      : (user.role ? [user.role] : []);
    const userRole = userRoles[0] || user.role;
    const userAgentId = user.agentId || (user as any).agentId;
    console.log('🔍 [CONTROLLER] Soumission de demande - User complet:', JSON.stringify(user, null, 2));
    console.log('🔍 [CONTROLLER] Rôle extrait:', userRole, 'Type:', typeof userRole);
    console.log('🔍 [CONTROLLER] AgentId extrait:', userAgentId, 'DemandeId:', id);
    return this.demandesService.soumettre(id, userRole);
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

