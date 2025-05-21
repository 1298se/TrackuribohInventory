# terraform/network.tf

# Define a security group for the Fargate task
resource "aws_security_group" "cron_task_sg" {
  name        = "${var.project_name}-cron-task-sg"
  description = "Allow outbound HTTPS, outbound PG to RDS, and allow RDS ingress from this SG"
  vpc_id      = var.vpc_id # Use the VPC ID variable

  # Allow all outbound traffic (common for tasks needing internet/AWS APIs)
  # Can be restricted further if needed.
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1" # All protocols
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name      = "${var.project_name}-cron-task-sg"
    ManagedBy = "Terraform"
  }
}

# --- Manage rules on EXISTING RDS Security Groups ---

# NOTE: Replace these hardcoded IDs with references if you also manage
# the RDS security groups with Terraform. Since we imported RDS which
# had existing SGs, we refer to them by ID here.
/* locals {
  # Reference the RDS local dev SG ID for the rule target
  rds_security_group_ids = [aws_security_group.rds_local_dev_access.id]
} */

# Allow ingress from the cron task SG to the RDS SGs on the PostgreSQL port
# Removing this standalone rule in favor of an inline rule
/* resource "aws_security_group_rule" "allow_task_to_rds" {
  # Create one rule for each RDS security group (now only 1)
  count = length(local.rds_security_group_ids)

  type                     = "ingress"
  from_port                = 5432 # PostgreSQL port
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = local.rds_security_group_ids[count.index] # Target existing RDS SG
  source_security_group_id = aws_security_group.cron_task_sg.id        # Allow from our new task SG
  description              = "Allow Ingress from Trackuriboh Cron Task SG"
} */


# --- Outputs ---
output "cron_task_security_group_id" {
  description = "ID of the Security Group for the Cron Task"
  value       = aws_security_group.cron_task_sg.id
}

# --- Security Group for Local Dev RDS Access ---

resource "aws_security_group" "rds_local_dev_access" {
  name        = "rds-local-dev-access"
  description = "TEMPORARY - Allow local dev access from ANY IP. RESTRICT LATER to specific IPs."
  vpc_id      = var.vpc_id

  ingress {
    description = "Allow local dev PG access from ANY IP"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # WARNING: Allows access from any IP. Restrict if possible.
  }

  ingress {
    description      = "Allow Ingress from Trackuriboh Cron Task SG"
    from_port        = 5432
    to_port          = 5432
    protocol         = "tcp"
    security_groups  = [aws_security_group.cron_task_sg.id]
  }

  # Allow all outbound traffic (optional, but common for security groups)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name      = "rds-local-dev-access"
    ManagedBy = "Terraform"
  }
} 