# Animl API
An AWS Lambda-based, GraphQl interface for performing CRUD operations on camera 
trap data stored in MongoDB.

## `Related repos`

- Animl API               http://github.com/tnc-ca-geo/animl-api
- Animl frontend          http://github.com/tnc-ca-geo/animl-frontend
- Animl base program      http://github.com/tnc-ca-geo/animl-base
- Animl ingest function   http://github.com/tnc-ca-geo/animl-ingest
- Exif service            https://github.com/tnc-ca-geo/exif-api
- Animl email extraction  https://github.com/tnc-ca-geo/animl-email-relay
- Animl ML resources      http://github.com/tnc-ca-geo/animl-ml
- Animl analytics         http://github.com/tnc-ca-geo/animl-analytics

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
- [Apollo Server](https://www.apollographql.com/docs/apollo-server/)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) via 
[Mongoose](https://mongoosejs.com/)

## `Development`

### Prerequisits
The instructions below assume you have the following tools globally installed:
- Node & npm
- [Serverless](https://www.serverless.com/framework/docs/getting-started/)
- [aws-cli](https://aws.amazon.com/cli/)
- [Docker] (https://docs.docker.com/engine/install/)

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

### Preparing remote config variables
The API depends on remote secrets and parameters that are stored in AWS Secrets 
Manager and AWS Systems Manager Parameter Store, respectively. Most of the 
params are generated by this project's serverless config file and the 
config files of other services upon which this app depends, but some must be 
created manually via the AWS console. To make sure you have the correct secrets 
and parameters available, do the following: 

1. Make sure you've deployed [animl-ingest](http://github.com/tnc-ca-geo/animl-ingest), 
[animl-frontent](http://github.com/tnc-ca-geo/animl-frontend), 
and [mira-api](https://github.com/tnc-ca-geo/animl-ml/tree/master/api/mira) in the 
same staging env (dev/prod) as the environtment you intend to deploy `animl-api`.

2. We currently depend on a CloudFormation template ProductOps created called 
`UserPool` that creates and manages all of the resources related to Auth/Auth. 
This is not tracked in version control (but it probably should be), as it's 
critical and is responssible for generating SSM Params upon which this app 
depends. Make sure that that stack has been created. 

3. Two important SSM Params, `/ml/megadetector-api-key-[env]` and 
`/db/mongo-db-url-[env]` contain secret keys so need to be created manually in 
the AWS console. Be sure to create versions for all envs you plan on deploying.

### Seeding db
You'll need to create the DB in MongoDB Atlas, but once you have, a script for 
seeding the DB with default records can be found at
```animl-api/src/scripts/seedDB.js```. If the DB hasn't been seeded yet, 
you can do so by running the following command from the root directory:
```
npm run seed-db-dev 
# or, do seed the production db:
npm run seed-db-prod
```

### Local testing and dev deployment
- To test the Lambda locally with serverless-offline, run: 
```
npm run start
```

Note: The first time running serverless will require you to the login to the serverless console and be granted a seat from the TNC organization. 

- To deploy the Cloudformation development stack, run: 
```
npm run deploy-dev
``` 

## `Data managment`
There are a handful of scripts in the `src/scripts/` directory to assist with 
managing data in both the production and dev databases.

### `Creating backups`
To create a complete JSON export of all collections in a DB, run:
```
npm run export-db-dev   // export dev db
npm run export-db-prod  // export prod db
```

### `Importing data from a backups`
TODO: write and test `importDb.js`

### `Updating documents in MongoDB`
`updateDocuments.js` is a working template for writing targeted data updates. 
It can be adapted to perform specific deletions/updates. You can run it with 
the following: 
```
npm run update-docs-dev   // update dev db
npm run update-docs-prod  // update prod db
```

## Prod deployment
Use caution when deploying to production, as the application involves multiple stacks (animl-ingest, animl-api, animl-frontend), and often the deployments need to be synchronized. For major deployments to prod in which there are breaking changes that affect the other components of the stack, follow these steps:

1. Set the frontend `IN_MAINTENANCE_MODE` to `true` (in `animl-frontend/src/config.js`), deploy to prod, then invalidate its cloudfront cache. This will temporarily prevent users from interacting with the frontend (editing labels, bulk uploading images, etc.) while the rest of the updates are being deployed.

2. Set ingest-image's `IN_MAINTENANCE_MODE` to `true` (in `animl-ingest/ingest-image/task.js`) and deploy to prod. While in maintenance mode, any images from wireless cameras that happen to get sent to the ingestion bucket will be routed instead to the `animl-images-parkinglot-prod` bucket so that Animl isn't trying to process new images while the updates are being deployed.
   
3. Wait for messages in ALL SQS queues to wind down to zero (i.e., if there's currently a bulk upload job being processed, wait for it to finish).

4. Backup prod DB by running `npm run export-db-prod` from the `animl-api` project root.

5. Deploy animl-api to prod.

6. Turn off `IN_MAINTENANCE_MODE` in animl-frontend and animl-ingest, and deploy both to prod, and clear cloudfront cache.

7. Copy any images that happened to land in `animl-images-parkinglot-prod` while the stacks were being deployed to `animl-images-ingestion-prod`, and then delete them from the parking lot bucket.
