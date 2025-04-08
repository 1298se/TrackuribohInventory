# ecs.tf

# Get AWS Account ID and Region for constructing ARNs/URIs
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Define the ECS Cluster (will be created if it doesn't exist)
resource "aws_ecs_cluster" "cron_cluster" {
  name = var.ecs_cluster_name

  tags = {
    Name      = var.ecs_cluster_name
    ManagedBy = "Terraform"
  }
}

# Define the CloudWatch Log Group for the task
resource "aws_cloudwatch_log_group" "cron_log_group" {
  name              = "/ecs/${var.project_name}/cron-tasks" # Standard naming convention
  retention_in_days = 30 # Optional: Configure log retention

  tags = {
    Name      = "${var.project_name}-cron-task-logs"
    ManagedBy = "Terraform"
  }
}

# Construct the ECR Image URI
locals {
  image_uri = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/${var.ecr_repo_name}:${var.image_tag}"
}

# Define the ECS Task Definition
resource "aws_ecs_task_definition" "update_catalog_task" {
  family                   = "${var.project_name}-update-catalog"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  task_role_arn            = aws_iam_role.cron_task_role.arn
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn

  # Define the container within the task
  container_definitions = jsonencode([
    {
      name      = "${var.project_name}-update-catalog-container"
      image     = local.image_uri
      essential = true # Task fails if this container stops

      # Explicitly define the command to run the catalog update script
      # This matches the Dockerfile CMD but makes it explicit
      command = ["python", "-m", "cron.tasks.update_catalog_db"]

      # Configure logging to CloudWatch
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.cron_log_group.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs" # Prefix for log streams within the group
        }
      }

      # Inject secrets from Secrets Manager as environment variables
      secrets = [
        # Database Credentials
        # The keys here (e.g., DB_USERNAME) MUST match the expected env var names
        # in your application (core/environment.py uses lowercase implicitly via pydantic)
        {
          name      = "db_username" # Env var name in container
          valueFrom = "${aws_secretsmanager_secret.db_credentials.arn}:username::" # Key in secret JSON
        },
        {
          name      = "db_password" # Env var name in container
          valueFrom = "${aws_secretsmanager_secret.db_credentials.arn}:password::" # Key in secret JSON
        },
        {
          name      = "db_endpoint" # Env var name in container
          valueFrom = "${aws_secretsmanager_secret.db_credentials.arn}:host::" # Key in secret JSON
        },
        {
          name      = "db_port" # Env var name in container
          valueFrom = "${aws_secretsmanager_secret.db_credentials.arn}:port::" # Key in secret JSON
        },
        {
          name      = "db_name" # Env var name in container
          valueFrom = "${aws_secretsmanager_secret.db_credentials.arn}:dbname::" # Key in secret JSON
        },
        # TCGPlayer Credentials
        {
          name      = "tcgplayer_client_id" # Env var name in container
          valueFrom = "${aws_secretsmanager_secret.tcgplayer_credentials.arn}:TCGPLAYER_CLIENT_ID::" # Key in secret JSON
        },
        {
          name      = "tcgplayer_client_secret" # Env var name in container
          valueFrom = "${aws_secretsmanager_secret.tcgplayer_credentials.arn}:TCGPLAYER_CLIENT_SECRET::" # Key in secret JSON
        }
        # Add other non-sensitive environment variables if needed
        # {
        #   name = "ENV"
        #   value = "PROD" # Example
        # },
      ]

      # Add other non-sensitive environment variables if needed using 'environment'
      environment = [
        {
          name = "ENV" # Matches the expected variable name
          value = "PROD" # Setting to PROD for deployed tasks
        },
        # Add any other non-secret environment variables here
      ]

      # Port mappings (not usually needed for a cron task unless it serves traffic briefly)
      # portMappings = [
      #   {
      #     containerPort = 8000 # Example if the app listens on a port
      #     hostPort      = 8000
      #   }
      # ]
    }
  ])

  tags = {
    Name      = "${var.project_name}-update-catalog-task-def"
    ManagedBy = "Terraform"
  }
}

# --- Define ECS Task Definition for Inventory Update ---
resource "aws_ecs_task_definition" "update_inventory_task" {
  family                   = "${var.project_name}-update-inventory"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu # Reusing variables, adjust if needed
  memory                   = var.task_memory # Reusing variables, adjust if needed
  task_role_arn            = aws_iam_role.cron_task_role.arn
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn

  container_definitions = jsonencode([
    {
      name      = "${var.project_name}-update-inventory-container"
      image     = local.image_uri
      essential = true

      # Specify the command to run the inventory update script
      command = ["python", "cron/tasks/update_inventory_prices.py"]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.cron_log_group.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs-inventory" # Use a different prefix for easier log filtering
        }
      }

      # Use the same secrets as the catalog task
      secrets = [
        {
          name      = "db_username"
          valueFrom = "${aws_secretsmanager_secret.db_credentials.arn}:username::"
        },
        {
          name      = "db_password"
          valueFrom = "${aws_secretsmanager_secret.db_credentials.arn}:password::"
        },
        {
          name      = "db_endpoint"
          valueFrom = "${aws_secretsmanager_secret.db_credentials.arn}:host::"
        },
        {
          name      = "db_port"
          valueFrom = "${aws_secretsmanager_secret.db_credentials.arn}:port::"
        },
        {
          name      = "db_name"
          valueFrom = "${aws_secretsmanager_secret.db_credentials.arn}:dbname::"
        },
        {
          name      = "tcgplayer_client_id"
          valueFrom = "${aws_secretsmanager_secret.tcgplayer_credentials.arn}:TCGPLAYER_CLIENT_ID::"
        },
        {
          name      = "tcgplayer_client_secret"
          valueFrom = "${aws_secretsmanager_secret.tcgplayer_credentials.arn}:TCGPLAYER_CLIENT_SECRET::"
        }
      ]

      # Use the same environment variables as the catalog task
      environment = [
        {
          name = "ENV"
          value = "PROD"
        }
      ]
    }
  ])

  tags = {
    Name      = "${var.project_name}-update-inventory-task-def"
    ManagedBy = "Terraform"
  }
}

# --- Outputs ---
output "ecs_cluster_id" {
  description = "ID of the ECS Cluster"
  value       = aws_ecs_cluster.cron_cluster.id
}

output "ecs_task_definition_arn" {
  description = "ARN of the ECS Task Definition"
  value       = aws_ecs_task_definition.update_catalog_task.arn
}

output "ecs_task_definition_inventory_arn" {
  description = "ARN of the Inventory Update ECS Task Definition"
  value       = aws_ecs_task_definition.update_inventory_task.arn
}

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch Log Group"
  value       = aws_cloudwatch_log_group.cron_log_group.name
} 