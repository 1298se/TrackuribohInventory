# terraform/events.tf

# --- Update Inventory Schedule (Hourly) ---
resource "aws_cloudwatch_event_rule" "update_inventory_schedule" {
  name                = "${var.project_name}-snapshot-inventory-sku-prices-rule"
  description         = "Runs cron.tasks.snapshot_inventory_sku_prices every hour (top of the hour) to snapshot current inventory SKU prices"
  schedule_expression = "cron(0 * * * ? *)" # Runs at the start of every hour

  tags = {
    Name      = "${var.project_name}-snapshot-inventory-sku-prices-rule"
    ManagedBy = "Terraform"
  }
}

resource "aws_cloudwatch_event_target" "ecs_inventory_task_target" {
  rule      = aws_cloudwatch_event_rule.update_inventory_schedule.name
  arn       = aws_ecs_cluster.cron_cluster.arn
  role_arn  = aws_iam_role.event_bridge_role.arn
  target_id = "${var.project_name}-snapshot-inventory-sku-prices-target"

  ecs_target {
    launch_type         = "FARGATE"
    task_count          = 1
    task_definition_arn = aws_ecs_task_definition.snapshot_inventory_sku_prices_task.arn
    platform_version    = "LATEST"

    network_configuration {
      subnets          = var.private_subnet_ids
      security_groups  = var.task_security_group_ids
      assign_public_ip = true
    }
  }
}

# --- SKU Price History Snapshot Schedule (Phase 1) ---
resource "aws_cloudwatch_event_rule" "snapshot_product_sku_prices_schedule" {
  name                = "${var.project_name}-snapshot-product-sku-prices-rule"
  description         = "Runs cron.tasks.snapshot_product_sku_prices daily (03:00 UTC) to snapshot product SKU price data"
  schedule_expression = var.snapshot_product_sku_prices_schedule_expression

  tags = {
    Name      = "${var.project_name}-snapshot-product-sku-prices-rule"
    ManagedBy = "Terraform"
  }
}

resource "aws_cloudwatch_event_target" "ecs_snapshot_product_sku_prices_target" {
  rule      = aws_cloudwatch_event_rule.snapshot_product_sku_prices_schedule.name
  arn       = aws_ecs_cluster.cron_cluster.arn
  role_arn  = aws_iam_role.event_bridge_role.arn
  target_id = "${var.project_name}-snapshot-product-sku-prices-target"

  ecs_target {
    launch_type         = "FARGATE"
    task_count          = 1
    task_definition_arn = aws_ecs_task_definition.snapshot_product_sku_prices_task.arn
    platform_version    = "LATEST"

    network_configuration {
      subnets          = var.private_subnet_ids
      security_groups  = var.task_security_group_ids
      assign_public_ip = true
    }
  }
}

# --- Snapshot Inventory Schedule (Daily at 00:05 UTC) ---
resource "aws_cloudwatch_event_rule" "snapshot_inventory_schedule" {
  name                = "${var.project_name}-snapshot-inventory-rule"
  description         = "Runs cron.tasks.snapshot_inventory daily at 00:05 UTC to create daily inventory snapshots"
  schedule_expression = "cron(5 0 * * ? *)" # Daily at 00:05 UTC

  tags = {
    Name      = "${var.project_name}-snapshot-inventory-rule"
    ManagedBy = "Terraform"
  }
}

resource "aws_cloudwatch_event_target" "ecs_snapshot_inventory_target" {
  rule      = aws_cloudwatch_event_rule.snapshot_inventory_schedule.name
  arn       = aws_ecs_cluster.cron_cluster.arn
  role_arn  = aws_iam_role.event_bridge_role.arn
  target_id = "${var.project_name}-snapshot-inventory-target"

  ecs_target {
    launch_type         = "FARGATE"
    task_count          = 1
    task_definition_arn = aws_ecs_task_definition.snapshot_inventory_task.arn
    platform_version    = "LATEST"

    network_configuration {
      subnets          = var.private_subnet_ids
      security_groups  = var.task_security_group_ids
      assign_public_ip = true
    }
  }
}

# --- Update Catalog DB Schedule ---
resource "aws_cloudwatch_event_rule" "update_catalog_db_schedule" {
  name                = "${var.project_name}-update-catalog-db-rule"
  description         = "Runs cron.tasks.update_catalog_db daily (08:00 UTC) to update the product catalog in the database"
  schedule_expression = var.task_schedule_expression

  tags = {
    Name      = "${var.project_name}-update-catalog-db-rule"
    ManagedBy = "Terraform"
  }
}

resource "aws_cloudwatch_event_target" "ecs_update_catalog_db_target" {
  rule      = aws_cloudwatch_event_rule.update_catalog_db_schedule.name
  arn       = aws_ecs_cluster.cron_cluster.arn
  role_arn  = aws_iam_role.event_bridge_role.arn
  target_id = "${var.project_name}-update-catalog-db-target"

  ecs_target {
    launch_type         = "FARGATE"
    task_count          = 1
    task_definition_arn = aws_ecs_task_definition.update_catalog_db_task.arn
    platform_version    = "LATEST"

    network_configuration {
      subnets          = var.private_subnet_ids
      security_groups  = var.task_security_group_ids
      assign_public_ip = true
    }
  }
}

# --- IAM Role for EventBridge to start ECS tasks ---
# EventBridge needs permissions to run tasks on ECS
resource "aws_iam_role" "event_bridge_role" {
  name = "${var.project_name}-eventbridge-ecs-role"

  assume_role_policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Action    = "sts:AssumeRole",
        Effect    = "Allow",
        Principal = {
          Service = "events.amazonaws.com"
        }
      },
    ]
  })

  tags = {
    Name      = "${var.project_name}-eventbridge-ecs-role"
    ManagedBy = "Terraform"
  }
}

# Policy granting EventBridge permission to run ECS tasks
resource "aws_iam_policy" "event_bridge_policy" {
  name = "${var.project_name}-eventbridge-ecs-policy"

  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = "ecs:RunTask",
        Resource = [
          aws_ecs_task_definition.snapshot_inventory_sku_prices_task.arn,
          aws_ecs_task_definition.snapshot_product_sku_prices_task.arn,
          aws_ecs_task_definition.snapshot_inventory_task.arn,
          aws_ecs_task_definition.update_catalog_db_task.arn
        ],
        Condition = {
          ArnEquals = {"ecs:cluster" = aws_ecs_cluster.cron_cluster.arn}
        }
      },
      {
        Effect    = "Allow",
        Action    = "iam:PassRole",
        Resource  = [
          aws_iam_role.cron_task_role.arn,
          aws_iam_role.ecs_task_execution_role.arn
        ],
        Condition = {StringLike = {"iam:PassedToService" = "ecs-tasks.amazonaws.com"}}
      }
    ]
  })

  tags = {
    Name      = "${var.project_name}-eventbridge-ecs-policy"
    ManagedBy = "Terraform"
  }
}

resource "aws_iam_role_policy_attachment" "event_bridge_attachment" {
  role       = aws_iam_role.event_bridge_role.name
  policy_arn = aws_iam_policy.event_bridge_policy.arn
} 