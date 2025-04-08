# terraform/events.tf

resource "aws_cloudwatch_event_rule" "update_catalog_schedule" {
  name                = "${var.project_name}-update-catalog-rule"
  description         = "Triggers the update catalog task periodically"
  schedule_expression = var.task_schedule_expression # Use the variable for the cron expression

  tags = {
    Name      = "${var.project_name}-update-catalog-rule"
    ManagedBy = "Terraform"
  }
}

resource "aws_cloudwatch_event_target" "ecs_task_target" {
  rule      = aws_cloudwatch_event_rule.update_catalog_schedule.name
  arn       = aws_ecs_cluster.cron_cluster.arn # Target the ECS cluster
  role_arn  = aws_iam_role.event_bridge_role.arn # Role needed by EventBridge to start ECS tasks

  # Define the ECS task target details
  ecs_target {
    task_count          = 1
    task_definition_arn = aws_ecs_task_definition.update_catalog_task.arn # The task def we created
    launch_type         = "FARGATE"
    platform_version    = "LATEST" # Use the latest Fargate platform version

    # Network configuration for the task when launched by EventBridge
    network_configuration {
      subnets          = var.private_subnet_ids      # Subnets for the task
      security_groups  = var.task_security_group_ids # SG for the task
      assign_public_ip = true # Required for Fargate tasks in public subnets to pull images/reach internet directly. Set to false if using private subnets with NAT Gateway.
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
        Resource = aws_ecs_task_definition.update_catalog_task.arn, # Allow running this specific task def
        # Condition to ensure it uses the correct roles (optional but good practice)
        # Condition = {
        #   ArnEquals = {
        #     "ecs:cluster" = aws_ecs_cluster.cron_cluster.arn
        #   }
        # }
      },
      {
        Effect    = "Allow",
        Action    = "iam:PassRole", # Allow EventBridge to pass the task roles to ECS
        Resource  = [
          aws_iam_role.cron_task_role.arn,
          aws_iam_role.ecs_task_execution_role.arn
        ],
        Condition = { # Only allow passing roles if the request comes from ECS
          StringLike = {
            "iam:PassedToService" = "ecs-tasks.amazonaws.com"
          }
        }
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