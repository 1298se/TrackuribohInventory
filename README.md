# Codex.tcg

A TCG (Trading Card Game) inventory and portfolio management platform. Track your card collection, monitor prices, analyze market trends, and manage buying/selling transactions across multiple marketplaces.

## Architecture

- **Backend API** (`/app`): FastAPI application with PostgreSQL database
- **Frontend Web** (`/web`): Next.js/React application with TypeScript
- **Cron Jobs** (`/cron`): Scheduled tasks for price updates and data synchronization
- **Core Services** (`/core`): Shared business logic, database models, and utilities

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- uv package manager: `pip install uv`

### Development Setup

1. **Clone and configure environment:**

   ```bash
   git clone <repo-url>
   cd trackuriboh_inv
   cp .env.example .env  # Create and configure your .env file
   ```

2. **Start the application:**
   ```bash
   source .venv/bin/activate  # On Linux/macOS (or .venv\Scripts\activate on Windows)
   make run-local
   ```

That's it! The command above will:

- Set up Python virtual environment and dependencies
- Install web dependencies
- Start both backend API (http://localhost:8000) and frontend (http://localhost:3000)

### Dependency Management

```bash
# Add a new Python package
uv pip install package_name
uv pip compile pyproject.toml -o uv.lock

# Update web dependencies
cd web && npm install <package-name>
```

## Database Setup

The application uses PostgreSQL with Alembic for migrations:

```bash
# Run database migrations
alembic upgrade head

# Create a new migration (after model changes)
alembic revision --autogenerate -m "Description of changes"
```

## Environment Variables

Create a `.env` file at the repository root (used by `core/environment.py`):

```env
# Application Environment
ENV=DEBUG  # or PROD

# Database Connection
DB_USERNAME=your_db_user
DB_PASSWORD=your_db_password
DB_ENDPOINT=localhost
DB_PORT=5432

# TCGPlayer API (server-to-server token grant)
TCGPLAYER_CLIENT_ID=your_tcgplayer_client_id
TCGPLAYER_CLIENT_SECRET=your_tcgplayer_client_secret

# TCGPlayer session cookie (manually rotated)
TCGPLAYER_COOKIE=tcg_auth_ticket=...

# AWS (Secrets Manager for cookie storage)
AWS_REGION=us-east-1
TCGPLAYER_COOKIE_SECRET_NAME=your-secret-name-or-arn

# Supabase Authentication
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key

# CORS (optional; defaults to localhost:3000)
# CORS_ORIGINS=["http://localhost:3000","https://localhost:3000"]

# Deployment Variables (for AWS ECS)
ACCOUNT_ID=your_aws_account_id
REGION=us-east-1
API_CLUSTER_NAME=your-api-cluster
API_SERVICE_NAME=your-api-service
CRON_REPO=your-cron-repo
API_REPO=your-api-repo
```

## Development Workflow

### Testing

```bash
# Run Python tests
pytest

# Run web tests
cd web && npm test
```

### Linting & Formatting

```bash
# Python linting
ruff check .
mypy .

# Web linting
cd web && npm run lint
```

### Cron Jobs

```bash
# Run specific cron task locally
make run-cron CRON_TASK=snapshot_inventory
make run-cron CRON_TASK=purchase_decision_sweep
```

### TCGPlayer Cookie Rotation

The automated refresh job has been removed. Rotate the session cookie manually by logging into TCGplayer, copying the `TCGAuthTicket_Production` value, and updating the `TCGPLAYER_COOKIE` secret (or local env var) so API and cron calls continue to authenticate.

## Deployment

### Backend Deployment (Fly.io)

The backend API is deployed to Fly.io:

1. **Install Fly CLI:**

   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login to Fly.io:**

   ```bash
   fly auth login
   ```

3. **Deploy to Fly.io:**

   ```bash
   fly deploy
   ```

4. **Check deployment status:**
   ```bash
   fly status
   fly logs
   ```

### Frontend Deployment (Cloudflare Workers)

The frontend is deployed to Cloudflare Workers:

1. **Install Wrangler CLI:**

   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare:**

   ```bash
   wrangler login
   ```

3. **Deploy to Cloudflare:**

   ```bash
   cd web
   npm run deploy
   # or
   npx @opennextjs/cloudflare deploy
   ```

## Lock File Strategy

The authoritative lock file is `uv.lock`, committed to version control for deterministic builds. Legacy `requirements*.txt` files are no longer used.
