include .env
export

# Derived variables
ECR_URL = $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com

# Default targets
.PHONY: deploy-all
deploy-all: deploy-cron deploy-api

.PHONY: deploy-cron
deploy-cron: login build-cron tag-cron push-cron update-lambda

.PHONY: deploy-api
deploy-api: login build-api tag-api push-api
	aws ecs update-service --cluster $(API_CLUSTER_NAME) --service $(API_SERVICE_NAME) --force-new-deployment

# Login to ECR
.PHONY: login
login:
	aws ecr get-login-password --region $(REGION) | docker login --username AWS --password-stdin $(ECR_URL)

# Generic build function
# We use --provenance false so that it only pushes one image - otherwise it pushes an image index (3 total images)
define build_image
	docker build --platform linux/amd64 --no-cache --provenance false -f $(1)/Dockerfile -t $(2) .
endef

# Generic tag function
define tag_image
	docker tag $(1):$(IMAGE_TAG) $(ECR_URL)/$(1):$(IMAGE_TAG)
endef

# Generic push function
define push_image
	docker push $(ECR_URL)/$(1):$(IMAGE_TAG)
endef

# Generic run function
define docker_run
	docker stop trackuriboh-$(1) || true
	docker rm trackuriboh-$(1) || true
	docker run -d --name trackuriboh-$(1) $(2) --env-file .env $(3)
endef

# Run targets locally
.PHONY: run-cron
run-cron: build-cron
	$(call docker_run,cron,,$(CRON_REPO))

.PHONY: run-api
run-api: build-api
	$(call docker_run,api,-p 80:80,$(API_REPO))

# Build targets
.PHONY: build-cron
build-cron:
	$(call build_image,cron,$(CRON_REPO))

.PHONY: build-api
build-api:
	$(call build_image,app,$(API_REPO))


# Run targets locally
.PHONY: run-cron
run-cron: build-cron
	$(call docker_run,cron,,$(CRON_REPO))

.PHONY: run-api
run-api: build-api
	$(call docker_run,api,-p 80:80,$(API_REPO))

# Tag targets
.PHONY: tag-cron
tag-cron:
	$(call tag_image,$(CRON_REPO))

.PHONY: tag-api
tag-api:
	$(call tag_image,$(API_REPO))

# Push targets
.PHONY: push-cron
push-cron:
	$(call push_image,$(CRON_REPO))

.PHONY: push-api
push-api:
	$(call push_image,$(API_REPO))

# Update Lambda function
.PHONY: update-lambda
update-lambda:
	aws lambda update-function-code --function-name $(LAMBDA_FUNCTION) --image-uri $(ECR_URL)/$(CRON_REPO):$(IMAGE_TAG)