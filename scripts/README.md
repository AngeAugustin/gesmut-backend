# Scripts d'Initialisation

## Créer un Administrateur Initial

Après avoir configuré MongoDB Atlas, vous devez créer un premier utilisateur administrateur pour pouvoir vous connecter.

### Utilisation Simple

```bash
cd backend
npm run init:admin
```

Cela créera un administrateur avec les informations par défaut :
- **Email** : `admin@gesmut.mg`
- **Mot de passe** : `Admin123!`

### Utilisation Personnalisée

Pour créer un admin avec vos propres informations :

**Windows (PowerShell) :**
```powershell
$env:ADMIN_EMAIL="votre@email.com"; $env:ADMIN_PASSWORD="VotreMotDePasse"; npm run init:admin
```

**Linux/Mac :**
```bash
ADMIN_EMAIL=votre@email.com ADMIN_PASSWORD=VotreMotDePasse npm run init:admin
```

### Variables d'Environnement Disponibles

- `ADMIN_EMAIL` : Email de l'administrateur (défaut: `admin@gesmut.mg`)
- `ADMIN_PASSWORD` : Mot de passe de l'administrateur (défaut: `Admin123!`)
- `ADMIN_NOM` : Nom de l'administrateur (défaut: `Administrateur`)
- `ADMIN_PRENOM` : Prénom de l'administrateur (défaut: `Système`)

### Notes Importantes

⚠️ **Sécurité** : Changez le mot de passe par défaut après votre première connexion !

Le script vérifie automatiquement :
- Si un admin actif existe déjà (il ne créera pas de doublon)
- Si l'email existe déjà (il activera le compte si c'est un admin)

### Résolution du Problème "Unauthorized"

Si vous voyez l'erreur `UnauthorizedException: Utilisateur non trouvé`, cela signifie que :

1. Votre token JWT fait référence à un utilisateur qui n'existe pas dans MongoDB Atlas
2. La base de données MongoDB Atlas est vide (nouvelle base)

**Solution** :
1. Supprimez votre token JWT du navigateur (déconnexion)
2. Exécutez le script `npm run init:admin` pour créer un admin
3. Connectez-vous avec les identifiants de l'admin créé
