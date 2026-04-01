#!/bin/bash
# init.sh - 初始化项目环境
echo "Installing dependencies..."
npm install
echo "Initializing git..."
git init
git add .
git commit -m "Initial commit for Long-running Agent workflow"
echo "Environment initialized."
