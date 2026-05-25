#!/bin/sh
set -e

brew install node

# Écrire le chemin exact de node pour les build phases Xcode
# CI=true (minuscules) car Xcode Cloud met CI=TRUE que getenv d'Expo ne reconnaît pas
{
  echo "export NODE_BINARY=$(which node)"
  echo "export CI=true"
} > "$CI_PRIMARY_REPOSITORY_PATH/ios/.xcode.env.local"

cd "$CI_PRIMARY_REPOSITORY_PATH"
npm ci

cd ios
pod install
