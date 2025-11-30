import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';

@Controller('agents')
@UseGuards(JwtAuthGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.DGR)
  create(@Body() createAgentDto: any) {
    return this.agentsService.create(createAgentDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.DGR, Role.DNCF)
  findAll() {
    return this.agentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.agentsService.findOne(id);
  }

  @Get(':id/anciennete')
  async getAnciennete(@Param('id') id: string) {
    const anciennete = await this.agentsService.calculerAnciennete(id);
    return { agentId: id, anciennete };
  }

  @Get(':id/responsables')
  async getResponsables(@Param('id') id: string) {
    return this.agentsService.getResponsablesByAgentId(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.DGR)
  update(@Param('id') id: string, @Body() updateAgentDto: any) {
    return this.agentsService.update(id, updateAgentDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.agentsService.remove(id);
  }

  @Post('eligibles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DNCF)
  findEligibles(@Body() criteres: any) {
    return this.agentsService.findEligiblesPourMutationStrategique(criteres);
  }
}

