include .env
export

# Use Git SHA as the default image tag unless overridden in .env or environment
IMAGE_TAG = $(shell git rev-parse --short HEAD)

# Derived variables
ECR_URL = $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com

# Default targets
.PHONY: deploy-all
deploy-all: deploy-cron deploy-api

.PHONY: update-service
update-service:
	aws ecs update-service \
		--cluster $(CLUSTER) \
		--service $(SERVICE) \
		--force-new-deployment

.PHONY: deploy-cron
deploy-cron: login build-cron tag-cron push-cron apply-infra-cron

.PHONY: deploy-api
deploy-api: login build-api tag-api push-api
	$(MAKE) update-service CLUSTER=$(API_CLUSTER_NAME) SERVICE=$(API_SERVICE_NAME)

# Login to ECR
.PHONY: login
login:
	@echo "Logging into ECR $(ECR_URL)..."
	aws ecr get-login-password --region $(REGION) | docker login --username AWS --password-stdin $(ECR_URL)

# Generate uv.lock if it doesn't exist
.PHONY: ensure-uv-lock
ensure-uv-lock:
	@if [ ! -f uv.lock ]; then \
		echo "Generating uv.lock..."; \
		uv pip compile pyproject.toml -o uv.lock; \
	fi

# Generic build function
# We use --provenance false so that it only pushes one image - otherwise it pushes an image index (3 total images)
define build_image
	@echo "Building $(2) image tagged $(IMAGE_TAG) from $(1)/Dockerfile..."
	docker build --platform linux/amd64 --no-cache --provenance false -f $(1)/Dockerfile -t $(2):$(IMAGE_TAG) .
endef

# Generic tag function
define tag_image
	@echo "Tagging $(1):$(IMAGE_TAG) for ECR..."
	docker tag $(1):$(IMAGE_TAG) $(ECR_URL)/$(1):$(IMAGE_TAG)
endef

# Generic push function
define push_image
	@echo "Pushing $(ECR_URL)/$(1):$(IMAGE_TAG) to ECR..."
	docker push $(ECR_URL)/$(1):$(IMAGE_TAG)
endef

# Generic run function
define docker_run
	docker stop codex-tcg-$(1) || true
	docker rm codex-tcg-$(1) || true
	docker run -d --name codex-tcg-$(1) $(2) --env-file .env $(3):$(IMAGE_TAG)
endef

# Build targets
.PHONY: build-cron
build-cron: ensure-uv-lock
	$(call build_image,cron,$(CRON_REPO))

.PHONY: build-api
build-api: ensure-uv-lock
	$(call build_image,app,$(API_REPO))


# Run targets locally
.PHONY: run-cron
run-cron: build-cron
	$(call docker_run,cron,-p 9000:8080,$(CRON_REPO))

.PHONY: run-api
run-api: build-api
	$(call docker_run,api,-p 8000:8000,$(API_REPO))

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

# Local development targets (uv)
.PHONY: setup
setup: ensure-uv-lock
	uv venv
	uv pip sync uv.lock

.PHONY: update-deps
update-deps:
	uv pip compile pyproject.toml -o uv.lock

.PHONY: run-local
run-local:
	uvicorn app.main:app --reload

# New target to apply Terraform changes for cron
.PHONY: apply-infra-cron
apply-infra-cron:
	@echo "Applying Terraform changes for image tag $(IMAGE_TAG)..."
	cd terraform && terraform apply -auto-approve -var="image_tag=$(IMAGE_TAG)"
