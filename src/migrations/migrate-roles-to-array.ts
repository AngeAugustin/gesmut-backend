/**
 * Script de migration pour convertir le champ role en roles (tableau)
 * 
 * Ce script :
 * 1. Convertit tous les utilisateurs qui ont un champ 'role' (string) en 'roles' (array)
 * 2. Conserve la compatibilité en gardant temporairement les deux champs
 * 3. Peut être exécuté plusieurs fois de manière sécurisée (idempotent)
 * 
 * Usage:
 *   - En développement : npm run migrate:roles
 *   - En production : s'assurer d'avoir une sauvegarde avant d'exécuter
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { connect, connection, model, Schema } from 'mongoose';

// Charger les variables d'environnement depuis le fichier .env
dotenv.config({ path: resolve(__dirname, '../../.env') });

// Utiliser la même URI par défaut que l'application principale
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gesmut';

interface UserDocument {
  _id: any;
  email: string;
  role?: string;
  roles?: string[];
  [key: string]: any;
}

const UserSchema = new Schema({
  email: String,
  role: String,
  roles: [String],
}, { strict: false, collection: 'users' });

const User = model('User', UserSchema, 'users');

async function migrateRoles() {
  try {
    console.log('🔄 Connexion à MongoDB...');
    console.log(`📍 URI: ${MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`); // Masquer le mot de passe si présent
    
    try {
      await connect(MONGODB_URI);
      console.log('✅ Connecté à MongoDB');
    } catch (connectError: any) {
      if (connectError.code === 'ECONNREFUSED' || connectError.message?.includes('ECONNREFUSED')) {
        console.error('\n❌ Erreur: Impossible de se connecter à MongoDB.');
        console.error('   Assurez-vous que MongoDB est démarré et accessible.');
        console.error(`   URI tentée: ${MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`);
        console.error('\n💡 Solutions possibles:');
        console.error('   1. Démarrer MongoDB: mongod (ou via un service Windows)');
        console.error('   2. Vérifier que MongoDB écoute sur le port 27017');
        console.error('   3. Vérifier la variable d\'environnement MONGODB_URI dans .env');
        process.exit(1);
      }
      throw connectError;
    }

    // Trouver tous les utilisateurs qui ont un champ 'role' mais pas de 'roles' ou 'roles' vide
    const usersToMigrate = await User.find({
      $or: [
        { role: { $exists: true, $ne: null }, $or: [{ roles: { $exists: false } }, { roles: { $size: 0 } }] },
        { role: { $exists: true, $ne: null }, roles: null },
      ],
    }).exec();

    console.log(`📊 ${usersToMigrate.length} utilisateur(s) à migrer`);

    if (usersToMigrate.length === 0) {
      console.log('✅ Aucun utilisateur à migrer. Migration terminée.');
      await connection.close();
      return;
    }

    let migrated = 0;
    let errors = 0;

    for (const user of usersToMigrate) {
      try {
        const userDoc = user as any;
        const oldRole = userDoc.role;

        if (!oldRole) {
          console.warn(`⚠️  Utilisateur ${userDoc.email} n'a pas de rôle, ignoré`);
          continue;
        }

        // Convertir le rôle en tableau
        await User.updateOne(
          { _id: userDoc._id },
          {
            $set: {
              roles: [oldRole],
            },
          }
        );

        console.log(`✅ ${userDoc.email}: ${oldRole} → [${oldRole}]`);
        migrated++;
      } catch (error) {
        console.error(`❌ Erreur pour l'utilisateur ${user.email}:`, error);
        errors++;
      }
    }

    console.log('\n📈 Résumé de la migration:');
    console.log(`   ✅ Migrés: ${migrated}`);
    console.log(`   ❌ Erreurs: ${errors}`);
    console.log(`   📊 Total: ${usersToMigrate.length}`);

    // Optionnel : Supprimer le champ 'role' après migration (décommenter si souhaité)
    // console.log('\n🗑️  Suppression des anciens champs role...');
    // const removeResult = await User.updateMany(
    //   { roles: { $exists: true, $ne: [] } },
    //   { $unset: { role: '' } }
    // );
    // console.log(`✅ ${removeResult.modifiedCount} champs 'role' supprimés`);

    console.log('\n✅ Migration terminée avec succès!');
    await connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    await connection.close();
    process.exit(1);
  }
}

// Exécuter la migration
if (require.main === module) {
  migrateRoles();
}

export default migrateRoles;

