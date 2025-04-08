# iam.tf

# -------------------------------------
# ECS Task Execution Role
# -------------------------------------
# Allows ECS tasks to call AWS services on your behalf (ECR pull, CloudWatch logs)
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
# Permissions granted to the application running inside the container
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

# Define the policy allowing read access to the specific secrets
resource "aws_iam_policy" "cron_task_secrets_policy" {
  name        = "${var.project_name}-cron-task-secrets-policy"
  description = "Allow cron task to read required secrets from Secrets Manager"

  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ],
        Effect   = "Allow",
        Resource = "*" # Allow access to ALL secrets
      }
    ]
  })

  tags = {
    Name      = "${var.project_name}-cron-task-secrets-policy"
    ManagedBy = "Terraform"
  }
}

# Attach the secrets policy ALSO to the Task Execution Role
# This is required because the ECS agent (using the execution role)
# needs permission to fetch secrets specified in the task definition's
# 'secrets' configuration block for injection.
resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_secrets_attachment" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = aws_iam_policy.cron_task_secrets_policy.arn # Reuse the same policy
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