import { Controller, Get, Patch, Param, Delete, UseGuards, Body, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/roles.enum';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.DNCF)
  findOne(@Param('id') id: string, @CurrentUser() currentUser: any) {
    // Un utilisateur peut voir ses propres données, ou un admin peut voir n'importe quel utilisateur
    if (currentUser.role !== Role.ADMIN && currentUser.id !== id) {
      throw new ForbiddenException('Vous ne pouvez accéder qu\'à vos propres données');
    }
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.DNCF)
  update(@Param('id') id: string, @Body() updateUserDto: any, @CurrentUser() currentUser: any) {
    // Un utilisateur peut mettre à jour ses propres données (signature, cachet), ou un admin peut mettre à jour n'importe quel utilisateur
    if (currentUser.role !== Role.ADMIN && currentUser.id !== id) {
      throw new ForbiddenException('Vous ne pouvez modifier que vos propres données');
    }
    
    // Si c'est le DNCF qui met à jour ses propres données, ne permettre que signature et cachet
    if (currentUser.role === Role.DNCF && currentUser.id === id) {
      const allowedFields = ['signatureImageId', 'cachetImageId'];
      const filteredData: any = {};
      for (const field of allowedFields) {
        if (updateUserDto[field] !== undefined) {
          filteredData[field] = updateUserDto[field];
        }
      }
      updateUserDto = filteredData;
    }
    
    // Nettoyer les données
    if (updateUserDto.agentId === '' || updateUserDto.agentId === null) {
      delete updateUserDto.agentId;
    }
    return this.usersService.update(id, updateUserDto);
  }

  @Patch(':id/activate')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async activate(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.usersService.update(id, { isActive: body.isActive });
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}

