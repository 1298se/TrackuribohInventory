# iam.tf

# -------------------------------------
# ECS Task Execution Role
# -------------------------------------
# Used by the ECS agent (not your app code) to pull the image, write logs, and fetch
# container-level injected secrets. Should be READ-ONLY for secrets injection.
resource "aws_iam_role" "ecs_task_execution_role" {
  name               = "${var.project_name}-ecs-task-execution-role"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Action    = "sts:AssumeRole",
        Effect    = "Allow",
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name      = "${var.project_name}-ecs-task-execution-role"
    ManagedBy = "Terraform"
  }
}

# Attach the standard AWS managed policy for ECS task execution
resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# -------------------------------------
# ECS Task Role
# -------------------------------------
# Assumed by the application code running inside the container. This role grants runtime
# permissions the app needs (e.g., read/write a specific secret).
resource "aws_iam_role" "cron_task_role" {
  name               = "${var.project_name}-cron-task-role"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Action    = "sts:AssumeRole",
        Effect    = "Allow",
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name      = "${var.project_name}-cron-task-role"
    ManagedBy = "Terraform"
  }
}

# Read-only policy for the ECS agent to inject container secrets (Get/Describe only)
# Scope to the specific secrets referenced in terraform/ecs.tf
resource "aws_iam_policy" "ecs_execution_read_secrets_policy" {
  name        = "${var.project_name}-ecs-execution-read-secrets"
  description = "Allow ECS execution role to read injected secrets for containers"

  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ],
        Resource = [
          data.aws_secretsmanager_secret.db_credentials.arn,
          data.aws_secretsmanager_secret.tcgplayer_credentials.arn,
          data.aws_secretsmanager_secret.ebay_credentials.arn,
          data.aws_secretsmanager_secret.sentry.arn,
          data.aws_secretsmanager_secret.redis.arn
        ]
      }
    ]
  })

  tags = {
    Name      = "${var.project_name}-ecs-execution-read-secrets"
    ManagedBy = "Terraform"
  }
}

# Attach read-only secrets policy to the Execution Role
resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_secrets_attachment" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = aws_iam_policy.ecs_execution_read_secrets_policy.arn
}

# Read/write policy for the app to update the cookie secret at runtime
# Scope writes only to the cookie secret; allow reads to the same if needed
resource "aws_iam_policy" "cron_task_cookie_rw_policy" {
  name        = "${var.project_name}-cron-task-cookie-rw"
  description = "Allow cron task to read/write the TCG cookie secret"

  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
          "secretsmanager:PutSecretValue"
        ],
        Resource = data.aws_secretsmanager_secret.tcgplayer_cookie.arn
      }
    ]
  })

  tags = {
    Name      = "${var.project_name}-cron-task-cookie-rw"
    ManagedBy = "Terraform"
  }
}

# Attach the cookie read/write policy to the Task Role so the container code can update it
resource "aws_iam_role_policy_attachment" "cron_task_role_cookie_rw_attachment" {
  role       = aws_iam_role.cron_task_role.name
  policy_arn = aws_iam_policy.cron_task_cookie_rw_policy.arn
}

# EventBridge publish policy for snapshot task to trigger compute task
resource "aws_iam_policy" "cron_task_eventbridge_policy" {
  name        = "${var.project_name}-cron-task-eventbridge"
  description = "Allow cron task to publish EventBridge events"

  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = "events:PutEvents",
        Resource = "arn:aws:events:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:event-bus/default"
      }
    ]
  })

  tags = {
    Name      = "${var.project_name}-cron-task-eventbridge"
    ManagedBy = "Terraform"
  }
}

# Attach EventBridge policy to the Task Role
resource "aws_iam_role_policy_attachment" "cron_task_role_eventbridge_attachment" {
  role       = aws_iam_role.cron_task_role.name
  policy_arn = aws_iam_policy.cron_task_eventbridge_policy.arn
}

# --- Outputs ---
output "ecs_task_execution_role_arn" {
  description = "ARN of the ECS Task Execution Role"
  value       = aws_iam_role.ecs_task_execution_role.arn
}

output "cron_task_role_arn" {
  description = "ARN of the Cron Task Role"
  value       = aws_iam_role.cron_task_role.arn
} 
