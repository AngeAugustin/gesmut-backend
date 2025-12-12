import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(createUserDto: any, createdByAdmin: boolean = false): Promise<User> {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const userData = {
      ...createUserDto,
      password: hashedPassword,
    };
    // Ne pas inclure agentId s'il est vide
    if (userData.agentId === '' || userData.agentId === null) {
      delete userData.agentId;
    }
    // Définir isActive : true si créé par admin, false si auto-inscription
    if (userData.isActive === undefined) {
      userData.isActive = createdByAdmin;
    }
    const user = new this.userModel(userData);
    return user.save();
  }

  async findOne(id: string): Promise<User | null> {
    return this.userModel.findById(id).exec();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findByAgentId(agentId: string): Promise<User | null> {
    return this.userModel.findOne({ agentId: agentId.toString() }).exec();
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      // Vérifier que le compte est actif
      if (!user.isActive) {
        throw new Error('Compte non actif. Veuillez contacter l\'administrateur.');
      }
      return user;
    }
    return null;
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.userModel.findByIdAndUpdate(userId, { password: hashedPassword }).exec();
  }

  async findAll(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  async update(id: string, updateUserDto: any): Promise<User> {
    const updateData = { ...updateUserDto };
    
    // Ne pas inclure agentId s'il est vide
    if (updateData.agentId === '' || updateData.agentId === null) {
      delete updateData.agentId;
    }
    
    // Hasher le mot de passe seulement s'il est fourni
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    } else {
      // Ne pas mettre à jour le mot de passe s'il n'est pas fourni
      delete updateData.password;
    }
    
    return this.userModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
  }

  async remove(id: string): Promise<void> {
    await this.userModel.findByIdAndDelete(id).exec();
  }
}

