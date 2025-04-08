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
  description = "Base name for project resources"
  type        = string
  default     = "trackuriboh"
}

variable "vpc_id" {
  description = "ID of the VPC where the ECS task will run"
  type        = string
  # No default - must be provided (e.g., in terraform.tfvars)
}

variable "private_subnet_ids" {
  description = "List of subnet IDs for the ECS task (use default VPC public subnets in this case)"
  type        = list(string)
  # No default - must be provided (e.g., in terraform.tfvars)
}

variable "task_security_group_ids" {
  description = "List of security group IDs to attach to the ECS task"
  type        = list(string)
  # No default - must be provided (e.g., in terraform.tfvars)
}

variable "task_schedule_expression" {
  description = "Cron expression for the scheduled task (e.g., 'cron(0 5 * * ? *)' for 5 AM UTC daily)"
  type        = string
  default     = "cron(0 5 * * ? *)" # Default to 5 AM UTC daily
}

variable "task_cpu" {
  description = "CPU units for the ECS task"
  type        = number
  default     = 256 # 0.25 vCPU
}

variable "task_memory" {
  description = "Memory (in MiB) for the ECS task"
  type        = number
  default     = 512 # 0.5 GB
}

variable "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  type        = string
  default     = "trackuriboh-cron-cluster" # From .env
}

variable "ecr_repo_name" {
  description = "Name of the ECR repository (e.g., trackuriboh/cron)"
  type        = string
  default     = "trackuriboh/cron" # From .env
}

variable "image_tag" {
  description = "Image tag to use for the task"
  type        = string
  default     = "latest" # From .env
} 