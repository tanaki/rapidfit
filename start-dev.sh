#!/bin/bash
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
nvm use 22 --silent
cd /Users/nico/video-annotator
npm run dev -- --port 5173
