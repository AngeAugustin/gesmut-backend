import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    private notificationsGateway: NotificationsGateway,
  ) {}

  async create(createNotificationDto: any): Promise<Notification> {
    const notification = new this.notificationModel(createNotificationDto);
    const saved = await notification.save();

    // Envoyer via WebSocket
    if (createNotificationDto.type === 'IN_APP') {
      this.notificationsGateway.sendNotification(createNotificationDto.destinataireId, saved);
    }

    return saved;
  }

  async findByUser(userId: string): Promise<Notification[]> {
    return this.notificationModel.find({ destinataireId: userId }).sort({ createdAt: -1 }).exec();
  }

  async marquerCommeLu(id: string): Promise<Notification> {
    return this.notificationModel.findByIdAndUpdate(id, { lu: true, dateLecture: new Date() }, { new: true }).exec();
  }

  async countNonLues(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({ destinataireId: userId, lu: false }).exec();
  }

  async notifierDelaiDepasse(demandeId: string, destinataireId: string): Promise<void> {
    await this.create({
      destinataireId,
      type: 'IN_APP',
      titre: 'Délai dépassé',
      contenu: 'Le délai de traitement d\'une demande a été dépassé',
      demandeId,
    });
  }
}

