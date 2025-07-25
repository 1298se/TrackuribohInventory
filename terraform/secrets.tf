# secrets.tf
# Reference existing secrets in AWS Secrets Manager (created outside Terraform)

data "aws_secretsmanager_secret" "db_credentials" {
  name = "${var.project_name}/db_credentials"
}

data "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = data.aws_secretsmanager_secret.db_credentials.id
}

data "aws_secretsmanager_secret" "tcgplayer_credentials" {
  name = "${var.project_name}/tcgplayer_credentials"
}

data "aws_secretsmanager_secret_version" "tcgplayer_credentials" {
  secret_id = data.aws_secretsmanager_secret.tcgplayer_credentials.id
}

# Local values to parse the JSON secrets
locals {
  db_creds = jsondecode(data.aws_secretsmanager_secret_version.db_credentials.secret_string)
  tcgplayer_creds = jsondecode(data.aws_secretsmanager_secret_version.tcgplayer_credentials.secret_string)
}

# Output the ARNs of the secrets, needed for IAM policies later
output "db_credentials_secret_arn" {
  description = "ARN of the Secrets Manager secret for DB credentials"
  value       = data.aws_secretsmanager_secret.db_credentials.arn
}

output "tcgplayer_credentials_secret_arn" {
  description = "ARN of the Secrets Manager secret for TCGPlayer credentials"
  value       = data.aws_secretsmanager_secret.tcgplayer_credentials.arn
} 