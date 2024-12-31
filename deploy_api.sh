aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 235494812649.dkr.ecr.us-east-2.amazonaws.com

docker build -t trackuriboh/api .

docker tag trackuriboh/api:latest 235494812649.dkr.ecr.us-east-2.amazonaws.com/trackuriboh/api:latest

docker push 235494812649.dkr.ecr.us-east-2.amazonaws.com/trackuriboh/api:latest
