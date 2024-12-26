aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 235494812649.dkr.ecr.us-east-2.amazonaws.com
# Disable provenance so docker doesn't built an image index
docker build --platform linux/amd64  --no-cache --provenance false -f cron/Dockerfile -t trackuriboh/cron .
docker tag trackuriboh/cron:latest 235494812649.dkr.ecr.us-east-2.amazonaws.com/trackuriboh/cron:latest
docker push 235494812649.dkr.ecr.us-east-2.amazonaws.com/trackuriboh/cron:latest
aws lambda update-function-code --function-name trackuriboh-cron --image-uri 235494812649.dkr.ecr.us-east-2.amazonaws.com/trackuriboh/cron:latest