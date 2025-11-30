import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ReferentielsService } from './referentiels.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';

@Controller('referentiels')
export class ReferentielsController {
  constructor(private readonly referentielsService: ReferentielsService) {}

  // Directions
  @Get('directions')
  findAllDirections() {
    // Endpoint public pour permettre l'inscription
    return this.referentielsService.findAllDirections();
  }

  @Post('directions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  createDirection(@Body() createDto: any) {
    return this.referentielsService.createDirection(createDto);
  }

  @Patch('directions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateDirection(@Param('id') id: string, @Body() updateDto: any) {
    return this.referentielsService.updateDirection(id, updateDto);
  }

  @Delete('directions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  deleteDirection(@Param('id') id: string) {
    return this.referentielsService.deleteDirection(id);
  }

  // Services
  @Get('services')
  findAllServices() {
    // Endpoint public pour permettre l'inscription
    return this.referentielsService.findAllServices();
  }

  @Get('services/direction/:directionId')
  findServicesByDirection(@Body('directionId') directionId: string) {
    return this.referentielsService.findServicesByDirection(directionId);
  }

  @Post('services')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  createService(@Body() createDto: any) {
    return this.referentielsService.createService(createDto);
  }

  @Patch('services/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateService(@Param('id') id: string, @Body() updateDto: any) {
    return this.referentielsService.updateService(id, updateDto);
  }

  @Delete('services/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  deleteService(@Param('id') id: string) {
    return this.referentielsService.deleteService(id);
  }

  // Localités
  @Get('localites')
  findAllLocalites() {
    // Endpoint public pour permettre aux agents de voir les localités
    return this.referentielsService.findAllLocalites();
  }

  @Post('localites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  createLocalite(@Body() createDto: any) {
    return this.referentielsService.createLocalite(createDto);
  }

  @Patch('localites/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateLocalite(@Param('id') id: string, @Body() updateDto: any) {
    return this.referentielsService.updateLocalite(id, updateDto);
  }

  @Delete('localites/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  deleteLocalite(@Param('id') id: string) {
    return this.referentielsService.deleteLocalite(id);
  }

  // Grades
  @Get('grades')
  findAllGrades() {
    // Endpoint public pour permettre l'inscription
    return this.referentielsService.findAllGrades();
  }

  @Post('grades')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  createGrade(@Body() createDto: any) {
    return this.referentielsService.createGrade(createDto);
  }

  @Patch('grades/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateGrade(@Param('id') id: string, @Body() updateDto: any) {
    return this.referentielsService.updateGrade(id, updateDto);
  }

  @Delete('grades/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  deleteGrade(@Param('id') id: string) {
    return this.referentielsService.deleteGrade(id);
  }

  // Statuts
  @Get('statuts')
  findAllStatuts() {
    return this.referentielsService.findAllStatuts();
  }

  @Post('statuts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  createStatut(@Body() createDto: any) {
    return this.referentielsService.createStatut(createDto);
  }

  @Patch('statuts/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateStatut(@Param('id') id: string, @Body() updateDto: any) {
    return this.referentielsService.updateStatut(id, updateDto);
  }

  @Delete('statuts/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  deleteStatut(@Param('id') id: string) {
    return this.referentielsService.deleteStatut(id);
  }

  // Diplômes
  @Get('diplomes')
  findAllDiplomes() {
    return this.referentielsService.findAllDiplomes();
  }

  @Post('diplomes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  createDiplome(@Body() createDto: any) {
    return this.referentielsService.createDiplome(createDto);
  }

  @Patch('diplomes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateDiplome(@Param('id') id: string, @Body() updateDto: any) {
    return this.referentielsService.updateDiplome(id, updateDto);
  }

  @Delete('diplomes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  deleteDiplome(@Param('id') id: string) {
    return this.referentielsService.deleteDiplome(id);
  }

  // Compétences
  @Get('competences')
  findAllCompetences() {
    return this.referentielsService.findAllCompetences();
  }

  @Post('competences')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  createCompetence(@Body() createDto: any) {
    return this.referentielsService.createCompetence(createDto);
  }

  @Patch('competences/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateCompetence(@Param('id') id: string, @Body() updateDto: any) {
    return this.referentielsService.updateCompetence(id, updateDto);
  }

  @Delete('competences/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  deleteCompetence(@Param('id') id: string) {
    return this.referentielsService.deleteCompetence(id);
  }
}

