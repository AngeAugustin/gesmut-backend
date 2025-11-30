import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { PostesService } from './postes.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';
import { PosteStatus } from '../common/enums/poste-status.enum';

@Controller('postes')
export class PostesController {
  constructor(private readonly postesService: PostesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.DGR)
  create(@Body() createPosteDto: any) {
    return this.postesService.create(createPosteDto);
  }

  @Get()
  findAll() {
    // Endpoint public pour permettre l'inscription
    return this.postesService.findAll();
  }

  @Get('libres')
  findLibres() {
    // Endpoint public pour permettre aux agents de voir les postes libres
    return this.postesService.findByStatus(PosteStatus.LIBRE);
  }

  @Get('critiques')
  @UseGuards(JwtAuthGuard)
  findCritiques() {
    return this.postesService.findByStatus(PosteStatus.CRITIQUE);
  }

  @Get('service/:serviceId')
  @UseGuards(JwtAuthGuard)
  findByService(@Param('serviceId') serviceId: string) {
    return this.postesService.findByService(serviceId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.postesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.DGR)
  update(@Param('id') id: string, @Body() updatePosteDto: any) {
    return this.postesService.update(id, updatePosteDto);
  }

  @Post(':id/affecter')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.DGR)
  affecterAgent(@Param('id') id: string, @Body() body: { agentId: string }) {
    return this.postesService.affecterAgent(id, body.agentId);
  }

  @Post(':id/liberer')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.DGR)
  libererPoste(@Param('id') id: string) {
    return this.postesService.libererPoste(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.postesService.remove(id);
  }
}

