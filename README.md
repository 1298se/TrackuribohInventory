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

# TCGPlayer Login (for cron tasks)
TCGPLAYER_EMAIL=you@example.com
TCGPLAYER_PASSWORD=your_password

# AWS (Secrets Manager for cookie storage)
AWS_REGION=us-east-1
AWS_SECRETSMANAGER_SECRET_NAME=your-secret-name-or-arn

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
make run-cron CRON_TASK=refresh_tcg_cookie
make run-cron CRON_TASK=snapshot_inventory
```

## Deployment

The application deploys to AWS ECS using Docker containers:

```bash
# Deploy both API and cron services
make deploy-all

# Deploy individual services
make deploy-api
make deploy-cron
```

## Lock File Strategy

The authoritative lock file is `uv.lock`, committed to version control for deterministic builds. Legacy `requirements*.txt` files are no longer used.
