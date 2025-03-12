#!/bin/bash

# Install Fly CLI if not already installed
if ! command -v flyctl &> /dev/null; then
    echo "Installing Fly CLI..."
    curl -L https://fly.io/install.sh | sh
    export FLYCTL_INSTALL="/home/user/.fly"
    export PATH="$FLYCTL_INSTALL/bin:$PATH"
fi

# Login to Fly (first time only, will prompt for auth)
# flyctl auth login

# Deploy the application
echo "Deploying to Fly.io..."
flyctl deploy --config fly.toml

echo "Deployment completed!" 