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

### Create "animl" AWS config profile
The name of the profile must be "animl" (because it's referenced in the 
serverless.yml file). Good instructions 
[here](https://www.serverless.com/framework/docs/providers/aws/guide/credentials/).

### Make a project direcory, clone this repo, and install dependencies
```
mkdir animl-api
cd animl-api
git clone https://github.com/tnc-ca-geo/animl-api.git
cd animl-api
npm install
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

### Seeding db
A script for seeding the DB with default records can be found at
```animl-api/src/scripts/seedDB.js```. If the DB hasn't been seeded yet, 
you can do so by running the following command from the root directory:
```
npm run seed-db-dev 
# or, do seed the production db:
npm run seed-db-prod
```

