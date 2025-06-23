# Codex.tcg

## Development Setup with uv

This project uses [uv](https://github.com/astral-sh/uv) as the package manager.

### Prerequisites

Ensure you have Python 3.12+ and uv installed:

```bash
pip install uv
```

### Setup Virtual Environment

```bash
# Create a virtual environment
uv venv

# Activate the virtual environment
source .venv/bin/activate  # On Linux/macOS
# or
.venv\Scripts\activate     # On Windows
```

### Install Dependencies

```bash
# Install dependencies from the lock file for reproducibility
uv pip sync uv.lock
```

### Update Dependencies

```bash
# Add a new package
uv pip install package_name

# Re-resolve and regenerate the lock file
uv pip compile pyproject.toml -o uv.lock
```

### Running the Application

```bash
uvicorn app.main:app --reload
```

## Lock file strategy

The authoritative lock file is `uv.lock`, committed to version control for deterministic builds. Other `requirements*.txt` files are no longer used.
