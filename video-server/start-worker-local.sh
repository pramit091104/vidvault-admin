#!/bin/bash

# Local HLS Worker Startup Script
# Use this to test the worker locally before deploying to Render

echo "╔════════════════════════════════════════╗"
echo "║   Starting HLS Worker Locally         ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please create a .env file with required variables"
    exit 1
fi

# Check if Redis is running
echo "🔍 Checking Redis connection..."
if ! redis-cli ping > /dev/null 2>&1; then
    echo "⚠️  Warning: Redis not responding on localhost:6379"
    echo "   Make sure Redis is running:"
    echo "   - macOS: brew services start redis"
    echo "   - Linux: sudo systemctl start redis"
    echo "   - Docker: docker run -d -p 6379:6379 redis"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ Redis is running"
fi

# Check required environment variables
echo ""
echo "🔍 Checking environment variables..."

required_vars=("GCS_PROJECT_ID" "GCS_BUCKET_NAME" "GCS_CREDENTIALS")
missing_vars=()

for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" .env; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "❌ Missing required environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "   - $var"
    done
    exit 1
fi

echo "✅ All required variables found"
echo ""

# Start the worker
echo "🚀 Starting worker..."
echo ""
node worker.js
