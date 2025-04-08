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
locals {
  rds_security_group_ids = ["sg-0fe62ff722e6ba481"] # Only target the specific SG
}

# Allow ingress from the cron task SG to the RDS SGs on the PostgreSQL port
resource "aws_security_group_rule" "allow_task_to_rds" {
  # Create one rule for each RDS security group (now only 1)
  count = length(local.rds_security_group_ids)

  type                     = "ingress"
  from_port                = 5432 # PostgreSQL port
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = local.rds_security_group_ids[count.index] # Target existing RDS SG
  source_security_group_id = aws_security_group.cron_task_sg.id        # Allow from our new task SG
  description              = "Allow Ingress from Trackuriboh Cron Task SG"
}


# --- Outputs ---
output "cron_task_security_group_id" {
  description = "ID of the Security Group for the Cron Task"
  value       = aws_security_group.cron_task_sg.id
} 