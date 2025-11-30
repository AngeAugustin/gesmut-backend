# Guide de Déploiement Backend GESMUT sur Render.com

Ce guide vous explique comment déployer votre backend NestJS sur Render.com (solution gratuite) avec support SMTP Hostinger.

## 📋 Prérequis

- Un compte GitHub (gratuit)
- Un compte Render.com (gratuit)
- Un compte MongoDB Atlas (gratuit) - pour la base de données
- Un compte Hostinger avec accès SMTP (ou autre service SMTP)

---

## 🚀 Étape 1 : Préparer votre projet

### 1.1 Vérifier que votre code est sur GitHub

Assurez-vous que votre projet est poussé sur GitHub :

```bash
# Si ce n'est pas déjà fait
cd backend
git add .
git commit -m "Préparation pour déploiement"
git push origin main
```

### 1.2 Vérifier les scripts dans package.json

Votre `package.json` doit contenir ces scripts (déjà présents) :
- `build` : pour compiler TypeScript
- `start:prod` : pour démarrer en production

---

## 🌐 Étape 2 : Créer un compte Render.com

1. Allez sur [https://render.com](https://render.com)
2. Cliquez sur **"Get Started for Free"**
3. Inscrivez-vous avec votre compte GitHub (recommandé pour faciliter le déploiement)
4. Confirmez votre email

---

## 🗄️ Étape 3 : Configurer MongoDB Atlas (si pas déjà fait)

### 3.1 Créer un cluster MongoDB Atlas

1. Allez sur [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Créez un compte gratuit (M0 - Free Tier)
3. Créez un nouveau cluster (gratuit)
4. Attendez que le cluster soit créé (2-3 minutes)

### 3.2 Configurer l'accès réseau

1. Dans MongoDB Atlas, allez dans **"Network Access"**
2. Cliquez sur **"Add IP Address"**
3. Cliquez sur **"Allow Access from Anywhere"** (0.0.0.0/0) pour le développement
   - ⚠️ En production, limitez aux IPs de Render.com

### 3.3 Créer un utilisateur de base de données

1. Allez dans **"Database Access"**
2. Cliquez sur **"Add New Database User"**
3. Choisissez **"Password"** comme méthode d'authentification
4. Créez un nom d'utilisateur et un mot de passe **fort** (notez-les !)
5. Donnez le rôle **"Atlas admin"** ou **"Read and write to any database"**
6. Cliquez sur **"Add User"**

### 3.4 Obtenir la chaîne de connexion

1. Allez dans **"Database"** → Cliquez sur **"Connect"** sur votre cluster
2. Choisissez **"Connect your application"**
3. Sélectionnez **"Node.js"** et la version **"5.5 or later"**
4. Copiez la chaîne de connexion qui ressemble à :
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. Remplacez `<username>` et `<password>` par vos identifiants
6. Ajoutez le nom de la base de données à la fin :
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/gesmut?retryWrites=true&w=majority
   ```

---

## 🚢 Étape 4 : Déployer sur Render.com

### 4.1 Créer un nouveau service Web

1. Dans le tableau de bord Render, cliquez sur **"New +"**
2. Sélectionnez **"Web Service"**
3. Connectez votre repository GitHub si ce n'est pas déjà fait :
   - Cliquez sur **"Connect GitHub"**
   - Autorisez Render à accéder à vos repositories
   - Sélectionnez le repository **GESMUT**

### 4.2 Configurer le service

Remplissez les informations suivantes :

- **Name** : `gesmut-backend` (ou le nom de votre choix)
- **Region** : Choisissez la région la plus proche (ex: `Frankfurt` pour l'Europe)
- **Branch** : `main` (ou la branche que vous utilisez)
- **Root Directory** : `backend` ⚠️ **IMPORTANT** : Spécifiez `backend` car votre code est dans ce dossier
- **Runtime** : `Node`
- **Build Command** : `npm install && npm run build`
- **Start Command** : `npm run start:prod`
- **Instance Type** : `Free` (gratuit)

### 4.3 Configurer les variables d'environnement

Avant de déployer, cliquez sur **"Advanced"** puis **"Add Environment Variable"** et ajoutez toutes ces variables :

#### Variables de base de données
```
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/gesmut?retryWrites=true&w=majority
```
⚠️ Remplacez par votre vraie chaîne de connexion MongoDB Atlas

#### Variables JWT
```
JWT_SECRET=votre-secret-jwt-tres-securise-changez-moi-en-production
JWT_EXPIRES_IN=24h
```
⚠️ Générez un secret JWT fort (ex: utilisez `openssl rand -base64 32`)

#### Variables serveur
```
PORT=10000
NODE_ENV=production
```
⚠️ Render utilise le port défini dans la variable `PORT` ou celui fourni par `$PORT`

#### Variables CORS
```
CORS_ORIGIN=https://votre-frontend.vercel.app,https://votre-frontend.netlify.app
```
⚠️ Remplacez par l'URL de votre frontend déployé (séparées par des virgules si plusieurs)

#### Variables SMTP (Hostinger)
```
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@celvox.org
SMTP_PASS=Celvox@2025
SMTP_FROM=noreply@celvox.org
SMTP_FROM_NAME=GESMUT
SMTP_TLS_REJECT_UNAUTHORIZED=false
```
⚠️ Remplacez par vos vraies informations SMTP Hostinger

#### Variables de fichiers
```
MAX_FILE_SIZE=3145728
MAX_FILES_PER_REQUEST=4
```

### 4.4 Lancer le déploiement

1. Cliquez sur **"Create Web Service"**
2. Render va automatiquement :
   - Cloner votre repository
   - Installer les dépendances (`npm install`)
   - Compiler votre code (`npm run build`)
   - Démarrer votre application (`npm run start:prod`)

3. Attendez 5-10 minutes pour le premier déploiement

---

## 🔧 Étape 5 : Ajuster le code pour Render

### 5.1 Modifier main.ts pour utiliser le port de Render

Render fournit le port via la variable d'environnement `PORT`. Votre code utilise déjà `process.env.PORT || 3000`, ce qui est parfait.

Cependant, Render peut aussi utiliser `$PORT`. Modifions `main.ts` pour être sûr :

```typescript
const port = process.env.PORT || process.env.$PORT || 3000;
```

### 5.2 Vérifier que le build fonctionne

Le script `start:prod` dans votre `package.json` utilise `node dist/main`, ce qui est correct.

---

## ✅ Étape 6 : Vérifier le déploiement

### 6.1 Vérifier les logs

1. Dans Render, allez dans votre service
2. Cliquez sur l'onglet **"Logs"**
3. Vérifiez qu'il n'y a pas d'erreurs
4. Vous devriez voir : `🚀 Application démarrée avec succès !`

### 6.2 Tester l'API

1. Dans Render, votre service a une URL comme : `https://gesmut-backend.onrender.com`
2. Testez avec :
   ```bash
   curl https://votre-app.onrender.com
   ```
   ou ouvrez l'URL dans votre navigateur

### 6.3 Vérifier la connexion MongoDB

Les logs doivent montrer que MongoDB est connecté. Si vous voyez des erreurs de connexion :
- Vérifiez que l'IP de Render est autorisée dans MongoDB Atlas
- Vérifiez que `MONGODB_URI` est correcte dans les variables d'environnement

---

## 🔐 Étape 7 : Sécuriser MongoDB Atlas

### 7.1 Limiter l'accès réseau (recommandé)

1. Dans MongoDB Atlas, allez dans **"Network Access"**
2. Supprimez `0.0.0.0/0` si vous l'avez ajouté
3. Ajoutez l'IP de Render (vous pouvez trouver l'IP dans les logs Render ou contacter le support)

⚠️ Pour le moment, laissez `0.0.0.0/0` si vous n'avez pas l'IP exacte de Render.

---

## 📧 Étape 8 : Tester l'envoi d'emails SMTP

### 8.1 Vérifier la configuration SMTP

1. Vérifiez que toutes les variables SMTP sont correctement configurées
2. Les logs doivent afficher : `Transporteur SMTP configuré avec succès`

### 8.2 Tester l'envoi

Utilisez votre API pour envoyer un email de test (selon vos endpoints).

---

## 🔄 Étape 9 : Déploiements automatiques

Render déploie automatiquement à chaque push sur la branche `main` (ou celle que vous avez configurée).

Pour désactiver les déploiements automatiques :
1. Allez dans **"Settings"** de votre service
2. Désactivez **"Auto-Deploy"**

---

## 🛠️ Étape 10 : Initialiser l'administrateur

Après le déploiement, vous devez créer un utilisateur administrateur.

### Option 1 : Via Render Shell (recommandé)

1. Dans Render, allez dans votre service
2. Cliquez sur **"Shell"** (en haut à droite)
3. Exécutez :
   ```bash
   npm run init:admin
   ```
4. Suivez les instructions

### Option 2 : Via script local avec connexion distante

Modifiez temporairement `MONGODB_URI` dans votre `.env` local pour pointer vers Atlas, puis exécutez :
```bash
npm run init:admin
```

---

## 🐛 Résolution de problèmes

### Problème : "Application failed to respond"

**Solution** :
- Vérifiez que le port est correctement configuré
- Vérifiez les logs pour voir l'erreur exacte
- Assurez-vous que `start:prod` est correct dans `package.json`

### Problème : "Cannot connect to MongoDB"

**Solution** :
- Vérifiez que `MONGODB_URI` est correcte
- Vérifiez que l'IP est autorisée dans MongoDB Atlas
- Vérifiez les identifiants utilisateur/mot de passe

### Problème : "SMTP not configured"

**Solution** :
- Vérifiez que toutes les variables SMTP sont définies
- Vérifiez les identifiants Hostinger
- Vérifiez que le port 587 n'est pas bloqué

### Problème : "Build failed"

**Solution** :
- Vérifiez les logs de build
- Assurez-vous que `Root Directory` est défini sur `backend`
- Vérifiez que tous les fichiers nécessaires sont commités

### Problème : "CORS error"

**Solution** :
- Vérifiez que `CORS_ORIGIN` contient l'URL de votre frontend
- Vérifiez que l'URL est exacte (avec https://)

---

## 📝 Checklist de déploiement

- [ ] Code poussé sur GitHub
- [ ] Compte Render.com créé
- [ ] MongoDB Atlas configuré avec cluster gratuit
- [ ] Utilisateur MongoDB créé
- [ ] Chaîne de connexion MongoDB obtenue
- [ ] Service Web créé sur Render
- [ ] Root Directory défini sur `backend`
- [ ] Toutes les variables d'environnement configurées
- [ ] Déploiement réussi
- [ ] Logs vérifiés (pas d'erreurs)
- [ ] API accessible via l'URL Render
- [ ] Connexion MongoDB fonctionnelle
- [ ] SMTP configuré et testé
- [ ] Administrateur initialisé
- [ ] Frontend configuré pour utiliser l'URL Render

---

## 🔗 URLs utiles

- **Render Dashboard** : https://dashboard.render.com
- **MongoDB Atlas** : https://cloud.mongodb.com
- **Documentation Render** : https://render.com/docs
- **Documentation NestJS** : https://docs.nestjs.com

---

## 💡 Astuces

1. **Plan gratuit Render** :
   - Services gratuits s'endorment après 15 minutes d'inactivité
   - Le premier démarrage peut prendre 30-60 secondes
   - Pour éviter cela, utilisez un service de "ping" gratuit (ex: UptimeRobot)

2. **Logs** :
   - Les logs sont disponibles en temps réel dans Render
   - Utilisez `console.log` pour déboguer (visible dans les logs)

3. **Variables d'environnement** :
   - Ne commitez JAMAIS votre fichier `.env`
   - Utilisez toujours les variables d'environnement de Render

4. **Mises à jour** :
   - Chaque push sur `main` déclenche un nouveau déploiement
   - Vous pouvez aussi déclencher un déploiement manuel dans Render

---

## 🎉 Félicitations !

Votre backend est maintenant déployé sur Render.com ! 

Votre URL sera quelque chose comme : `https://gesmut-backend.onrender.com`

N'oubliez pas de mettre à jour votre frontend pour utiliser cette nouvelle URL au lieu de `http://localhost:3000`.
