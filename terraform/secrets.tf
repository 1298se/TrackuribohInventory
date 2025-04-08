# secrets.tf

resource "aws_secretsmanager_secret" "db_credentials" {
  name = "${var.project_name}/db_credentials" # e.g., trackuriboh/db_credentials

  tags = {
    Name      = "${var.project_name}-db-credentials"
    ManagedBy = "Terraform"
  }
}

resource "aws_secretsmanager_secret_version" "db_credentials_version" {
  secret_id     = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    # We get username, host, port directly from the RDS instance resource
    username = aws_db_instance.trackuriboh_db.username
    host     = aws_db_instance.trackuriboh_db.address
    port     = aws_db_instance.trackuriboh_db.port
    dbname   = var.db_name
    # The password comes from the sensitive input variable
    password = var.db_password
  })

  # Ignore changes to the secret string originating outside Terraform,
  # e.g., if secrets are rotated automatically by AWS or manually.
  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "tcgplayer_credentials" {
  name = "${var.project_name}/tcgplayer_credentials" # e.g., trackuriboh/tcgplayer_credentials

  tags = {
    Name      = "${var.project_name}-tcgplayer-credentials"
    ManagedBy = "Terraform"
  }
}

resource "aws_secretsmanager_secret_version" "tcgplayer_credentials_version" {
  secret_id     = aws_secretsmanager_secret.tcgplayer_credentials.id
  secret_string = jsonencode({
    # Values come from sensitive input variables
    TCGPLAYER_CLIENT_ID     = var.tcgplayer_client_id
    TCGPLAYER_CLIENT_SECRET = var.tcgplayer_client_secret
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# Output the ARNs of the secrets, needed for IAM policies later
output "db_credentials_secret_arn" {
  description = "ARN of the Secrets Manager secret for DB credentials"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "tcgplayer_credentials_secret_arn" {
  description = "ARN of the Secrets Manager secret for TCGPlayer credentials"
  value       = aws_secretsmanager_secret.tcgplayer_credentials.arn
} 