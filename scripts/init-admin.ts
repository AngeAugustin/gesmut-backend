import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/users/users.service';
import { Role } from '../src/common/enums/roles.enum';

async function bootstrap() {
  console.log('🚀 Démarrage du script d\'initialisation...');
  console.log('📡 Connexion à MongoDB...');
  
  let app;
  try {
    app = await NestFactory.createApplicationContext(AppModule);
    console.log('✅ Connexion MongoDB réussie !');
  } catch (error: any) {
    console.error('❌ Erreur de connexion MongoDB:', error.message);
    process.exit(1);
  }
  
  const usersService = app.get(UsersService);

  // Vérifier si un admin existe déjà
  const existingAdmins = await usersService.findAll();
  const hasAdmin = existingAdmins.some(user => user.role === Role.ADMIN && user.isActive);

  if (hasAdmin) {
    console.log('⚠️  Un administrateur actif existe déjà dans la base de données.');
    console.log('   Si vous souhaitez créer un nouvel admin, utilisez l\'interface web ou l\'API.');
    await app.close();
    return;
  }

  // Informations de l'admin par défaut
  const adminData = {
    email: process.env.ADMIN_EMAIL || 'admin@gesmut.mg',
    password: process.env.ADMIN_PASSWORD || 'Admin123!',
    nom: process.env.ADMIN_NOM || 'Administrateur',
    prenom: process.env.ADMIN_PRENOM || 'Système',
    role: Role.ADMIN,
    isActive: true,
  };

  try {
    // Vérifier si l'email existe déjà
    const existingUser = await usersService.findByEmail(adminData.email);
    if (existingUser) {
      console.log(`⚠️  Un utilisateur avec l'email ${adminData.email} existe déjà.`);
      if (existingUser.role === Role.ADMIN) {
        console.log('   Activation du compte admin existant...');
        const userId = (existingUser as any)._id?.toString();
        if (userId) {
          await usersService.update(userId, { isActive: true });
          console.log('✅ Compte admin activé avec succès !');
        }
      } else {
        console.log('   Cet utilisateur n\'est pas un admin. Veuillez utiliser un autre email.');
      }
      await app.close();
      return;
    }

    // Créer l'admin
    const admin = await usersService.create(adminData, true);
    console.log('✅ Administrateur créé avec succès !');
    console.log('\n📋 Informations de connexion :');
    console.log(`   Email: ${adminData.email}`);
    console.log(`   Mot de passe: ${adminData.password}`);
    console.log('\n⚠️  IMPORTANT: Changez ce mot de passe après votre première connexion !');
    console.log('\n💡 Pour créer un admin avec des informations personnalisées, utilisez :');
    console.log('   ADMIN_EMAIL=votre@email.com ADMIN_PASSWORD=VotreMotDePasse npm run init:admin');
  } catch (error: any) {
    console.error('❌ Erreur lors de la création de l\'administrateur :', error.message);
    if (error.code === 11000) {
      console.error('   Un utilisateur avec cet email existe déjà.');
    }
  } finally {
    await app.close();
  }
}

bootstrap();
