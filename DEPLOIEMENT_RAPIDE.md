# 🚀 Déploiement Rapide - Checklist

Guide rapide pour déployer le backend GESMUT sur Render.com

## ⚡ Étapes Rapides

### 1. Préparer GitHub
```bash
git add .
git commit -m "Préparation déploiement Render"
git push origin main
```

### 2. Créer MongoDB Atlas
- [ ] Aller sur https://www.mongodb.com/cloud/atlas
- [ ] Créer un cluster gratuit (M0)
- [ ] Créer un utilisateur DB (notez username/password)
- [ ] Autoriser IP `0.0.0.0/0` dans Network Access
- [ ] Obtenir la chaîne de connexion : `mongodb+srv://user:pass@cluster.mongodb.net/gesmut?retryWrites=true&w=majority`

### 3. Créer le service Render
- [ ] Aller sur https://render.com
- [ ] Créer un compte (via GitHub)
- [ ] New → Web Service
- [ ] Connecter le repository GitHub
- [ ] Configurer :
  - **Name** : `gesmut-backend`
  - **Root Directory** : `backend` ⚠️ IMPORTANT
  - **Build Command** : `npm ci --include=dev && npm run build`
  - **Start Command** : `npm run start:prod`
  - **Instance Type** : `Free`

### 4. Variables d'environnement (dans Render)

Copiez-collez ces variables dans Render (Settings → Environment) :

```env
# Database
MONGODB_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/gesmut?retryWrites=true&w=majority

# JWT
JWT_SECRET=changez-moi-par-un-secret-fort-et-securise
JWT_EXPIRES_IN=24h

# Server
PORT=10000
NODE_ENV=production

# CORS (remplacez par votre URL frontend)
CORS_ORIGIN=https://votre-frontend.vercel.app

# SMTP Hostinger
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@celvox.org
SMTP_PASS=Celvox@2025
SMTP_FROM=noreply@celvox.org
SMTP_FROM_NAME=GESMUT
SMTP_TLS_REJECT_UNAUTHORIZED=false

# Files
MAX_FILE_SIZE=3145728
MAX_FILES_PER_REQUEST=4
```

### 5. Déployer
- [ ] Cliquer sur "Create Web Service"
- [ ] Attendre 5-10 minutes
- [ ] Vérifier les logs (onglet Logs)
- [ ] Tester l'URL : `https://gesmut-backend.onrender.com`

### 6. Initialiser l'admin
- [ ] Dans Render, cliquer sur "Shell"
- [ ] Exécuter : `npm run init:admin`
- [ ] Suivre les instructions

## ✅ Vérifications

- [ ] Logs montrent "Application démarrée avec succès"
- [ ] Pas d'erreurs MongoDB dans les logs
- [ ] SMTP configuré (log : "Transporteur SMTP configuré")
- [ ] API accessible via l'URL Render
- [ ] Frontend configuré avec la nouvelle URL

## 🔗 URLs

- **Render Dashboard** : https://dashboard.render.com
- **MongoDB Atlas** : https://cloud.mongodb.com

## 📖 Guide Complet

Pour plus de détails, consultez : `GUIDE_DEPLOIEMENT_RENDER.md`
