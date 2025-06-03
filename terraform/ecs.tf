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

# Construct the ECR Image URI using the variable
locals {
  image_uri = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/${var.ecr_repo_name}:${var.image_tag}"
}

# --- Define ECS Task Definition for Inventory Update ---
resource "aws_ecs_task_definition" "snapshot_inventory_sku_prices_task" {
  family                   = "${var.project_name}-snapshot-inventory-sku-prices"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu # Reusing variables, adjust if needed
  memory                   = var.task_memory # Reusing variables, adjust if needed
  task_role_arn            = aws_iam_role.cron_task_role.arn
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn

  container_definitions = jsonencode([
    {
      name      = "${var.project_name}-snapshot-inventory-sku-prices-container"
      image     = local.image_uri
      essential = true

      # Specify the command to run the inventory update script AS A MODULE
      command = ["python", "-m", "cron.tasks.snapshot_inventory_sku_prices"]

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
          name      = "TCGPLAYER_CLIENT_ID"
          valueFrom = "${aws_secretsmanager_secret.tcgplayer_credentials.arn}:TCGPLAYER_CLIENT_ID::"
        },
        {
          name      = "TCGPLAYER_CLIENT_SECRET"
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
    Name      = "${var.project_name}-snapshot-inventory-sku-prices-task-def"
    ManagedBy = "Terraform"
  }
}

# --- Define ECS Task Definition for SKU Price History Snapshot ---
resource "aws_ecs_task_definition" "snapshot_product_sku_prices_task" {
  family                   = "${var.project_name}-snapshot-product-sku-prices"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  task_role_arn            = aws_iam_role.cron_task_role.arn
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn

  container_definitions = jsonencode([
    {
      name      = "${var.project_name}-snapshot-product-sku-prices-container"
      image     = local.image_uri
      essential = true

      command = ["python", "-m", "cron.tasks.snapshot_product_sku_prices"]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.cron_log_group.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs-product-sku-prices"
        }
      }

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
          name      = "TCGPLAYER_CLIENT_ID"
          valueFrom = "${aws_secretsmanager_secret.tcgplayer_credentials.arn}:TCGPLAYER_CLIENT_ID::"
        },
        {
          name      = "TCGPLAYER_CLIENT_SECRET"
          valueFrom = "${aws_secretsmanager_secret.tcgplayer_credentials.arn}:TCGPLAYER_CLIENT_SECRET::"
        }
      ]

      environment = [
        {
          name  = "ENV"
          value = "PROD"
        }
      ]
    }
  ])

  tags = {
    Name      = "${var.project_name}-snapshot-product-sku-prices-task-def"
    ManagedBy = "Terraform"
  }
}

# --- Define ECS Task Definition for Snapshot Inventory ---
resource "aws_ecs_task_definition" "snapshot_inventory_task" {
  family                   = "${var.project_name}-snapshot-inventory"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  task_role_arn            = aws_iam_role.cron_task_role.arn
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn

  container_definitions = jsonencode([
    {
      name      = "${var.project_name}-snapshot-inventory-container"
      image     = local.image_uri
      essential = true

      command = ["python", "-m", "cron.tasks.snapshot_inventory"]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.cron_log_group.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs-snapshot-inventory"
        }
      }

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
          name      = "TCGPLAYER_CLIENT_ID"
          valueFrom = "${aws_secretsmanager_secret.tcgplayer_credentials.arn}:TCGPLAYER_CLIENT_ID::"
        },
        {
          name      = "TCGPLAYER_CLIENT_SECRET"
          valueFrom = "${aws_secretsmanager_secret.tcgplayer_credentials.arn}:TCGPLAYER_CLIENT_SECRET::"
        }
      ]

      environment = [
        {
          name  = "ENV"
          value = "PROD"
        }
      ]
    }
  ])

  tags = {
    Name      = "${var.project_name}-snapshot-inventory-task-def"
    ManagedBy = "Terraform"
  }
}

# --- Define ECS Task Definition for Update Catalog DB ---
resource "aws_ecs_task_definition" "update_catalog_db_task" {
  family                   = "${var.project_name}-update-catalog-db"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  task_role_arn            = aws_iam_role.cron_task_role.arn
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn

  container_definitions = jsonencode([
    {
      name      = "${var.project_name}-update-catalog-db-container"
      image     = local.image_uri
      essential = true

      command = ["python", "-m", "cron.tasks.update_catalog_db"]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.cron_log_group.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs-update-catalog-db"
        }
      }

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
          name      = "TCGPLAYER_CLIENT_ID"
          valueFrom = "${aws_secretsmanager_secret.tcgplayer_credentials.arn}:TCGPLAYER_CLIENT_ID::"
        },
        {
          name      = "TCGPLAYER_CLIENT_SECRET"
          valueFrom = "${aws_secretsmanager_secret.tcgplayer_credentials.arn}:TCGPLAYER_CLIENT_SECRET::"
        }
      ]

      environment = [
        {
          name  = "ENV"
          value = "PROD"
        }
      ]
    }
  ])

  tags = {
    Name      = "${var.project_name}-update-catalog-db-task-def"
    ManagedBy = "Terraform"
  }
}

# --- Outputs ---
output "ecs_cluster_id" {
  description = "ID of the ECS Cluster"
  value       = aws_ecs_cluster.cron_cluster.id
}

output "ecs_task_definition_inventory_sku_prices_arn" {
  description = "ARN of the Inventory SKU Prices Update ECS Task Definition"
  value       = aws_ecs_task_definition.snapshot_inventory_sku_prices_task.arn
}

output "ecs_task_definition_snapshot_product_sku_prices_arn" {
  description = "ARN of the Product SKU Prices Snapshot ECS Task Definition"
  value       = aws_ecs_task_definition.snapshot_product_sku_prices_task.arn
}

output "ecs_task_definition_snapshot_inventory_arn" {
  description = "ARN of the Snapshot Inventory ECS Task Definition"
  value       = aws_ecs_task_definition.snapshot_inventory_task.arn
}

output "ecs_task_definition_update_catalog_db_arn" {
  description = "ARN of the Update Catalog DB ECS Task Definition"
  value       = aws_ecs_task_definition.update_catalog_db_task.arn
}

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch Log Group"
  value       = aws_cloudwatch_log_group.cron_log_group.name
} 