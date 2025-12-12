import { Controller, Post, Get, Param, UseGuards, UseInterceptors, UploadedFile, Res, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('upload')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 3145728 }), // 3 Mo
          new FileTypeValidator({ fileType: /(pdf|image|excel|word)/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const fileId = await this.uploadService.uploadFile(file);
    return {
      fileId,
      filename: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  @Post('image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 3145728 }), // 3 Mo
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    // Validation stricte des formats : JPG, JPEG, PNG uniquement
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['jpg', 'jpeg', 'png'];

    if (!allowedMimeTypes.includes(file.mimetype) || !fileExtension || !allowedExtensions.includes(fileExtension)) {
      throw new BadRequestException('Le fichier doit être au format JPG, JPEG ou PNG uniquement');
    }

    const fileId = await this.uploadService.uploadFile(file);
    return {
      fileId,
      filename: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  @Get(':id')
  async getFile(@Param('id') id: string, @Res() res: Response) {
    try {
      // Endpoint public pour permettre le téléchargement des fichiers
      const { stream, filename, contentType } = await this.uploadService.getFile(id);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      stream.pipe(res);
    } catch (error) {
      // Si le fichier n'existe pas, retourner un 404
      if (error.status === 404) {
        res.status(404).json({ message: error.message || 'File not found' });
      } else {
        res.status(500).json({ message: 'Error retrieving file' });
      }
    }
  }
}

