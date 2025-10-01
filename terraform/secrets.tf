# secrets.tf
# Reference existing secrets in AWS Secrets Manager (created outside Terraform)

data "aws_secretsmanager_secret" "db_credentials" {
  name = "${var.project_name}/db/credentials"
}

data "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = data.aws_secretsmanager_secret.db_credentials.id
}

data "aws_secretsmanager_secret" "tcgplayer_credentials" {
  name = "${var.project_name}/tcgplayer/credentials"
}

data "aws_secretsmanager_secret_version" "tcgplayer_credentials" {
  secret_id = data.aws_secretsmanager_secret.tcgplayer_credentials.id
}

data "aws_secretsmanager_secret" "ebay_credentials" {
  name = "${var.project_name}/ebay/credentials"
}

data "aws_secretsmanager_secret_version" "ebay_credentials" {
  secret_id = data.aws_secretsmanager_secret.ebay_credentials.id
}

# Local values to parse the JSON secrets
locals {
  db_creds = jsondecode(data.aws_secretsmanager_secret_version.db_credentials.secret_string)
  tcgplayer_creds = jsondecode(data.aws_secretsmanager_secret_version.tcgplayer_credentials.secret_string)
  ebay_creds = jsondecode(data.aws_secretsmanager_secret_version.ebay_credentials.secret_string)
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

output "ebay_credentials_secret_arn" {
  description = "ARN of the Secrets Manager secret for eBay credentials"
  value       = data.aws_secretsmanager_secret.ebay_credentials.arn
}

# TCG cookie secret used by services that call the TCGPlayer web endpoints
# Canonical hierarchical name
data "aws_secretsmanager_secret" "tcgplayer_cookie" {
  name = "${var.project_name}/tcgplayer/cookie"
}

output "tcgplayer_cookie_secret_arn" {
  description = "ARN of the Secrets Manager secret for the TCG cookie"
  value       = data.aws_secretsmanager_secret.tcgplayer_cookie.arn
}

# Sentry DSN for error monitoring
data "aws_secretsmanager_secret" "sentry" {
  name = "${var.project_name}/observability/sentry_dsn"
}

output "sentry_secret_arn" {
  description = "ARN of the Secrets Manager secret for Sentry DSN"
  value       = data.aws_secretsmanager_secret.sentry.arn
} 

# Redis connection URL used by backend services and cron tasks
data "aws_secretsmanager_secret" "redis" {
  name = "${var.project_name}/redis/url"
}

output "redis_secret_arn" {
  description = "ARN of the Secrets Manager secret for Redis URL"
  value       = data.aws_secretsmanager_secret.redis.arn
}

# Supabase configuration (URL and anon key)
# Stored as a JSON secret with keys SUPABASE_URL and SUPABASE_ANON_KEY
data "aws_secretsmanager_secret" "supabase" {
  name = "${var.project_name}/auth/supabase"
}

output "supabase_secret_arn" {
  description = "ARN of the Secrets Manager secret for Supabase config"
  value       = data.aws_secretsmanager_secret.supabase.arn
} 
