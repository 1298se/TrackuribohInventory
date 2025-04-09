# rds.tf

# Define the existing RDS instance to manage with Terraform
resource "aws_db_instance" "trackuriboh_db" {
  identifier             = "trackuriboh-inventory-db" # The actual name of the DB instance in AWS
  instance_class         = "db.t3.micro"
  allocated_storage      = 20
  storage_type           = "gp2"
  engine                 = "postgres"
  engine_version         = "16.4"
  username               = "postgres"
  # NOTE: The password should NOT be stored here.
  # It should be managed outside Terraform or rotated after import if unknown.
  # Since we're importing, Terraform won't set the initial password anyway.

  db_subnet_group_name   = "default-vpc-060ba3276b2147be2"
  parameter_group_name   = "default.postgres16"
  vpc_security_group_ids = [
    aws_security_group.cron_task_sg.id,        # Allow access from the cron tasks
    aws_security_group.rds_local_dev_access.id, # Allow local dev access
  ]

  multi_az               = false
  storage_encrypted      = true
  publicly_accessible    = true  # Updated to true for local dev access
  max_allocated_storage  = 1000   # Match existing autoscaling setting
  monitoring_interval    = 60     # Match existing enhanced monitoring interval
  # monitoring_role_arn  = var.rds_monitoring_role_arn # Potentially needed if interval > 0

  copy_tags_to_snapshot = true  # Match existing setting
  apply_immediately     = false # Match default behavior assumed by plan

  # Set to true to prevent accidental deletion via Terraform
  deletion_protection    = true

  # Set to true if you don't want a final snapshot when the instance is deleted via Terraform
  skip_final_snapshot    = true

  # It's crucial to ignore changes to the password in Terraform
  # if you are managing it outside or if it was set initially outside Terraform.
  lifecycle {
    ignore_changes = [password]
  }

  tags = {
    Name        = "trackuriboh-inventory-db"
    ManagedBy   = "Terraform"
    # Add any other existing tags or desired tags
  }
}

# Output the database endpoint for reference (useful for other resources)
output "db_endpoint" {
  description = "The connection endpoint for the RDS instance"
  value       = aws_db_instance.trackuriboh_db.endpoint
}

output "db_port" {
  description = "The port for the RDS instance"
  value       = aws_db_instance.trackuriboh_db.port
} 