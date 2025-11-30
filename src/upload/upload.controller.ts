import { Controller, Post, Get, Param, UseGuards, UseInterceptors, UploadedFile, Res, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator } from '@nestjs/common';
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

  @Get(':id')
  async getFile(@Param('id') id: string, @Res() res: Response) {
    // Endpoint public pour permettre le téléchargement des fichiers
    const { stream, filename, contentType } = await this.uploadService.getFile(id);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    stream.pipe(res);
  }
}

