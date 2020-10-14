# Animl API
An AWS Lambda-based, GraphQl interface for performing CRUD operations on camera 
trap data stored in MongoDB.

## `Related repos`

- Animl frontend          http://github.com/tnc-ca-geo/animl-frontend
- Animl base program      http://github.com/tnc-ca-geo/animl-base
- Animl ingest function   http://github.com/tnc-ca-geo/animl-ingest
- Animl ML resources      http://github.com/tnc-ca-geo/animl-ml
- Animl desktop app       https://github.com/tnc-ca-geo/animl-desktop

## `Overview`

Animl is an open, extensible, cloud-based platform for managing camera trap data.
We are developing this platform because there currently are no software tools that allow 
organizations using camera traps to:

- ingest data from a variety of camera trap types (wireless, SD card based, IP, etc.)
- systematically store and manage images in a single centralized, cloud-based repository
- upload custom object detection and species clasification ML models and configure 
automated assisted-labeling pipelines
- Offer frontend web application to view images, review ML-assisted labels, 
perform manual labeling
- Offer an API for advanced querying and analysis of camera trap data
- Offer tools for exporting ML model training data

This repository contains an AWS Lambda-based, GraphQl API for storing and 
fetching cameratrap data from a MongoDB database. The stack and and it's 
associated deployment resources are managed with the 
[Serverless Framework](serverless.com/). The stack includes:
- [Graphql Yoga](https://github.com/prisma-labs/graphql-yoga), which itself is 
based on [Apollo GraphQL Server](https://www.apollographql.com/docs/apollo-server/)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) via 
[Mongoose](https://mongoosejs.com/)

## `Development`

### Prerequisits
The instructions below assume you have the following tools globally installed:
- Node & npm
- [Serverless](https://www.serverless.com/framework/docs/getting-started/)
- [aws-cli](https://aws.amazon.com/cli/)

### Create "serverless-admin" AWS config profile
Good instructions 
[here](https://www.serverless.com/framework/docs/providers/aws/guide/credentials/).

### Make a project direcory, clone this repo, and install dependencies
```
mkdir animl-api
cd animl-api
git clone https://github.com/tnc-ca-geo/animl-api.git
cd animl-api
npm install
```

### Add a .env file
We use dotenv to manage secrets, so you'll need to create two .env files: one 
called `.env.prod` and one called `.env.dev` with the following variables:

```
# MongoDB
MONGO_DB_URL=<MongoDB Atlas url>

#AWS
REGION=us-west-1
AWS_PROFILE=serverless-admin
STAGE=dev
```

### Local testing and deployment
- To test the Lambda locally with serverless-offline, run: 
```
npm run start
```

- To deploy the Cloudformation development stack, run: 
```
npm run deploy-dev
``` 

- To deploy the Cloudformation production stack, run: 
```
npm run deploy-prod
```

