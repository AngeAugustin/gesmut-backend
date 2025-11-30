import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';

@Injectable()
export class UploadService {
  private gridFS: GridFSBucket;

  constructor(@InjectConnection() private connection: Connection) {
    this.gridFS = new GridFSBucket(this.connection.db, {
      bucketName: 'files',
    });
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    return new Promise((resolve, reject) => {
      const writeStream = this.gridFS.openUploadStream(file.originalname, {
        contentType: file.mimetype,
      });

      writeStream.write(file.buffer);
      writeStream.end();

      writeStream.on('finish', () => {
        resolve(writeStream.id.toString());
      });

      writeStream.on('error', reject);
    });
  }

  async getFile(fileId: string): Promise<{ stream: NodeJS.ReadableStream; filename: string; contentType: string }> {
    const objectId = new ObjectId(fileId);
    const files = await this.gridFS.find({ _id: objectId }).toArray();
    if (files.length === 0) {
      throw new Error('File not found');
    }
    const file = files[0];
    const stream = this.gridFS.openDownloadStream(objectId);
    return {
      stream,
      filename: file.filename,
      contentType: file.contentType || 'application/octet-stream',
    };
  }

  async deleteFile(fileId: string): Promise<void> {
    const objectId = new ObjectId(fileId);
    await this.gridFS.delete(objectId);
  }
}

