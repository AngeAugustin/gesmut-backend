#!/bin/bash
# Script de démarrage pour Render.com
# Ce script garantit que l'application démarre depuis le bon répertoire

# Aller dans le répertoire du script (backend)
cd "$(dirname "$0")"

# Vérifier que dist/main.js existe
if [ ! -f "dist/main.js" ]; then
  echo "Erreur: dist/main.js introuvable dans $(pwd)"
  echo "Contenu du répertoire:"
  ls -la
  echo "Contenu de dist (si existe):"
  ls -la dist/ 2>/dev/null || echo "Le dossier dist n'existe pas"
  exit 1
fi

# Démarrer l'application
node dist/main.js
