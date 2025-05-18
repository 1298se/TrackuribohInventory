# terraform/events.tf

# --- Update Catalog Schedule ---
resource "aws_cloudwatch_event_rule" "update_catalog_schedule" {
  name                = "${var.project_name}-update-catalog-rule"
  description         = "Triggers the update catalog task periodically"
  schedule_expression = var.task_schedule_expression # Expecting this variable holds the daily schedule (e.g., "cron(0 8 * * ? *)")

  tags = {
    Name      = "${var.project_name}-update-catalog-rule"
    ManagedBy = "Terraform"
  }
}

resource "aws_cloudwatch_event_target" "ecs_catalog_task_target" { # Renamed target for clarity
  rule      = aws_cloudwatch_event_rule.update_catalog_schedule.name
  arn       = aws_ecs_cluster.cron_cluster.arn
  role_arn  = aws_iam_role.event_bridge_role.arn

  ecs_target {
    task_count          = 1
    task_definition_arn = aws_ecs_task_definition.update_catalog_task.arn
    launch_type         = "FARGATE"
    platform_version    = "LATEST"

    network_configuration {
      subnets          = var.private_subnet_ids
      security_groups  = var.task_security_group_ids
      assign_public_ip = true
    }
  }
}

# --- Update Inventory Schedule (Hourly) ---
resource "aws_cloudwatch_event_rule" "update_inventory_schedule" {
  name                = "${var.project_name}-update-inventory-rule"
  description         = "Triggers the update inventory prices task hourly"
  schedule_expression = "cron(0 * * * ? *)" # Runs at the start of every hour

  tags = {
    Name      = "${var.project_name}-update-inventory-rule"
    ManagedBy = "Terraform"
  }
}

resource "aws_cloudwatch_event_target" "ecs_inventory_task_target" {
  rule      = aws_cloudwatch_event_rule.update_inventory_schedule.name
  arn       = aws_ecs_cluster.cron_cluster.arn
  role_arn  = aws_iam_role.event_bridge_role.arn
  target_id = "${var.project_name}-update-inventory-target"

  ecs_target {
    launch_type         = "FARGATE"
    task_count          = 1
    task_definition_arn = aws_ecs_task_definition.update_inventory_prices_task.arn
    platform_version    = "LATEST"

    network_configuration {
      subnets          = var.private_subnet_ids
      security_groups  = var.task_security_group_ids
      assign_public_ip = true
    }
  }
}

# --- Snapshot Inventory Schedule (Daily) ---
resource "aws_cloudwatch_event_rule" "snapshot_inventory_schedule" {
  name                = "${var.project_name}-snapshot-inventory-rule"
  description         = "Triggers the inventory snapshot task daily at 00:05 UTC"
  schedule_expression = "cron(5 0 * * ? *)"  # Runs at 00:05 UTC daily

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

# --- SKU Price History Snapshot Schedule (Phase 1) ---
resource "aws_cloudwatch_event_rule" "snapshot_sku_price_history_schedule" {
  name                = "${var.project_name}-snapshot-sku-price-history-rule"
  description         = "Triggers the SKU price history snapshot task daily"
  schedule_expression = var.snapshot_sku_price_history_schedule_expression

  tags = {
    Name      = "${var.project_name}-snapshot-sku-price-history-rule"
    ManagedBy = "Terraform"
  }
}

resource "aws_cloudwatch_event_target" "ecs_snapshot_sku_price_history_target" {
  rule      = aws_cloudwatch_event_rule.snapshot_sku_price_history_schedule.name
  arn       = aws_ecs_cluster.cron_cluster.arn
  role_arn  = aws_iam_role.event_bridge_role.arn
  target_id = "${var.project_name}-snapshot-sku-price-history-target"

  ecs_target {
    launch_type         = "FARGATE"
    task_count          = 1
    task_definition_arn = aws_ecs_task_definition.snapshot_sku_price_history_task.arn
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
          aws_ecs_task_definition.update_catalog_task.arn,
          aws_ecs_task_definition.update_inventory_prices_task.arn,
          aws_ecs_task_definition.snapshot_inventory_task.arn,
          aws_ecs_task_definition.snapshot_sku_price_history_task.arn
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