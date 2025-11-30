import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name) private auditModel: Model<AuditLogDocument>,
  ) {}

  async log(
    action: string,
    module: string,
    userId?: string,
    details?: any,
    ip?: string,
    userAgent?: string,
    additionalData?: {
      userEmail?: string;
      userRole?: string;
      method?: string;
      url?: string;
      statusCode?: number;
      requestBody?: any;
      responseData?: any;
      headers?: any;
      duration?: number;
      error?: string;
    }
  ): Promise<AuditLog> {
    const log = new this.auditModel({
      action,
      module,
      userId,
      userEmail: additionalData?.userEmail,
      userRole: additionalData?.userRole,
      details,
      ip: ip || 'unknown',
      userAgent,
      method: additionalData?.method,
      url: additionalData?.url,
      statusCode: additionalData?.statusCode,
      requestBody: additionalData?.requestBody,
      responseData: additionalData?.responseData,
      headers: additionalData?.headers,
      duration: additionalData?.duration,
      error: additionalData?.error,
      dateAction: new Date(),
    });
    return log.save();
  }

  async findAll(filters?: any): Promise<AuditLog[]> {
    const query: any = {};
    if (filters?.userId) query.userId = filters.userId;
    if (filters?.userEmail) query.userEmail = { $regex: filters.userEmail, $options: 'i' };
    if (filters?.userRole) query.userRole = filters.userRole;
    if (filters?.module) query.module = filters.module;
    if (filters?.action) query.action = { $regex: filters.action, $options: 'i' };
    if (filters?.ip) query.ip = { $regex: filters.ip, $options: 'i' };
    if (filters?.dateFrom || filters?.dateTo) {
      query.dateAction = {};
      if (filters.dateFrom) query.dateAction.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.dateAction.$lte = new Date(filters.dateTo);
    }
    if (filters?.statusCode) query.statusCode = filters.statusCode;
    if (filters?.method) query.method = filters.method;
    
    const limit = filters?.limit ? parseInt(filters.limit) : 1000;
    return this.auditModel
      .find(query)
      .populate({
        path: 'userId',
        select: 'email nom prenom role',
        model: 'User',
      })
      .sort({ dateAction: -1 })
      .limit(limit)
      .exec();
  }
}

