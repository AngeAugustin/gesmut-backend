import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { json } from 'express';
import * as os from 'os';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Augmenter la limite de taille du body pour permettre l'envoi de fichiers PDF en base64
  app.use(json({ limit: '10mb' }));

  // Enable CORS
  // Accepter les connexions depuis localhost et le réseau local
  const allowedOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : ['http://localhost:3001', 'http://192.168.1.61:3001'];
  
  app.enableCors({
    origin: (origin, callback) => {
      // Autoriser les requêtes sans origine (comme les apps mobiles ou Postman)
      if (!origin) return callback(null, true);
      
      // Vérifier si l'origine est autorisée
      if (allowedOrigins.includes(origin) || origin.startsWith('http://192.168.') || origin.startsWith('http://10.') || origin.startsWith('http://172.')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  // Trust proxy pour récupérer la vraie IP
  (app as any).set('trust proxy', true);

  // Global exception filter pour gérer toutes les erreurs
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        // Personnaliser les messages d'erreur de validation
        const messages = errors.map((error) => {
          const constraints = Object.values(error.constraints || {});
          return constraints.join(', ');
        });
        return new ValidationPipe().createExceptionFactory()(errors);
      },
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  
  // Afficher les URLs d'accès
  const networkInterfaces = os.networkInterfaces();
  let localIp = 'localhost';
  
  // Trouver l'adresse IP locale
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address.startsWith('192.168.')) {
        localIp = iface.address;
        break;
      }
    }
    if (localIp !== 'localhost') break;
  }
  
  console.log(`\n🚀 Application démarrée avec succès !`);
  console.log(`📍 Local:     http://localhost:${port}`);
  if (localIp !== 'localhost') {
    console.log(`🌐 Réseau:    http://${localIp}:${port}`);
  }
  console.log(`\n`);
}
bootstrap();

