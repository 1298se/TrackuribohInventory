# Trackuriboh Inventory

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
# Install dependencies from requirements.txt
uv pip install -r requirements.txt

# Install dev dependencies (if you have any)
uv pip install -r requirements-dev.txt  # If available
```

### Update Dependencies

```bash
# Add a new package
uv pip install package_name

# Update requirements.txt after adding packages
uv pip freeze > requirements-lock.txt
```

### Running the Application

```bash
uvicorn app.main:app --reload
```

## Migrated from Poetry

This project was migrated from Poetry to uv. The requirements.txt file contains all necessary dependencies, and requirements-lock.txt contains the exact versions currently installed. 