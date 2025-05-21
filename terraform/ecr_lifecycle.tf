data "aws_ecr_repository" "cron_repo" {
  name = var.ecr_repo_name
}

resource "aws_ecr_lifecycle_policy" "cron_cleanup" {
  repository = data.aws_ecr_repository.cron_repo.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Retain the 5 most recent images, expire older ones"
        selection    = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 5
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
} 