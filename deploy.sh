#!/bin/bash

# Quick deploy script for Numina Server on Render
export PATH="$HOME/bin:$PATH"

echo "🚀 Deploying Numina Server to Render..."
echo "📦 Service: server-a7od"
echo "🌐 URL: https://server-a7od.onrender.com"
echo ""

# Deploy the service
render services deploy srv-a7od --confirm

echo ""
echo "✅ Deploy command sent!"
echo "📋 Check status at: https://dashboard.render.com"
echo "🔍 View logs with: render services logs srv-a7od"