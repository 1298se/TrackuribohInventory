# variables.tf

variable "region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-2" # From your .env
}

variable "db_password" {
  description = "Password for the RDS database user"
  type        = string
  sensitive   = true # Mark as sensitive
  # No default - must be provided securely
}

variable "db_name" {
  description = "Name of the database within the RDS instance"
  type        = string
  default     = "postgres" # Assuming default, change if needed
}

variable "tcgplayer_client_id" {
  description = "TCGPlayer API Client ID"
  type        = string
  sensitive   = true # Mark as sensitive
  # No default - must be provided securely
}

variable "tcgplayer_client_secret" {
  description = "TCGPlayer API Client Secret"
  type        = string
  sensitive   = true # Mark as sensitive
  # No default - must be provided securely
}

variable "project_name" {
  description = "The base name for resources (e.g., codex-tcg)"
  type        = string
  default     = "codex-tcg"
}

variable "vpc_id" {
  description = "VPC ID for security groups"
  type        = string
  # Add your VPC ID here
  default = "vpc-02274d401b22e3095" # Example VPC ID, replace with yours
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for the ECS tasks"
  type        = list(string)
  # Add your actual private subnet IDs here
  default = ["subnet-095f4b7e5c8eef77d", "subnet-002b23ebe0247ec0c", "subnet-04d6c95985fe61856"]
}

variable "task_security_group_ids" {
  description = "List of security group IDs for the ECS tasks"
  type        = list(string)
  # Add the ID of the task security group created in network.tf
  # default = [aws_security_group.cron_task_sg.id] # Cannot use resource refs in defaults
  # Provide this via tfvars or command line if not using a default created SG ID
  # For now, using the known SG ID based on previous commands
  default = ["sg-07591221a4fcad611"]
}

variable "task_schedule_expression" {
  description = "Cron expression for the update catalog task schedule"
  type        = string
  default     = "cron(0 8 * * ? *)" # Default: 8 AM UTC daily
}

variable "task_cpu" {
  description = "CPU units for the ECS task"
  type        = number
  default     = 256 # Fargate minimum for 0.5GB memory
}

variable "task_memory" {
  description = "Memory (MiB) for the ECS task"
  type        = number
  default     = 512 # Fargate minimum
}

variable "ecs_cluster_name" {
  description = "Name of the ECS Cluster for cron tasks"
  type        = string
  default     = "codex-tcg-cron-cluster"
}

variable "ecr_repo_name" {
  description = "Name of the ECR repository for the cron image"
  type        = string
  default     = "codex-tcg/cron"
}

variable "image_tag" {
  description = "The Docker image tag to deploy (e.g., Git SHA or version number)"
  type        = string
  # No default value here, it must be provided via -var or a .tfvars file
}

variable "snapshot_product_sku_prices_schedule_expression" {
  description = "Cron expression for the product SKU prices snapshot task schedule"
  type        = string
  default     = "cron(0 3 * * ? *)" # Runs at 03:00 UTC daily
} 