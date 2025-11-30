import { Controller, Get, Post, Body, UseGuards, Patch, Param, Delete } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';

@Controller('workflow')
@UseGuards(JwtAuthGuard)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get()
  getActiveWorkflow() {
    return this.workflowService.getActiveWorkflow();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  createWorkflow(@Body() createDto: any) {
    return this.workflowService.createWorkflow(createDto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  updateWorkflow(@Param('id') id: string, @Body() updateDto: any) {
    return this.workflowService.updateWorkflow(id, updateDto);
  }

}

