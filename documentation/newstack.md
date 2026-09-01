# Deploying a New Animl Stack

This document outlines the steps needed to deploy an instance of the entire [animl.camera](https://animl.camera) stack to AWS. For a comprehensive overview of the Animl architecture and how its services are integrated, see the [architecture documentation](README.md).

In order to create a new instance of the entire Animl stack, we need to deploy
each resource in a certain order to ensure everything is working properly:

1. MongoDB
2. Cognito UserPool
3. animl-API
4. animl-ingest
5. exif-API
6. animl-frontend
7. animl-ml

## Prerequisites

- An AWS account with admin permissions
- [Node.js & npm](https://nodejs.org/)
- [Serverless Framework](https://www.serverless.com/framework/docs/getting-started/)
- [AWS CLI](https://aws.amazon.com/cli/) configured with an `animl` profile
- [Docker](https://docs.docker.com/engine/install/)
- Access to the following repositories (all of them are public repositories):
  - [animl-api](https://github.com/tnc-ca-geo/animl-api)
  - [animl-ingest](https://github.com/tnc-ca-geo/animl-ingest)
  - [animl-frontend](https://github.com/tnc-ca-geo/animl-frontend)
  - [exif-api](https://github.com/tnc-ca-geo/exif-api)
  - [animl-ml](https://github.com/tnc-ca-geo/animl-ml) (for ML model deployment)

## Deployment Steps

1. The project requires a MongoDB cluster, and if you need to create one see [mongo.md](./mongo.md).
After you create a MongoDb cluster, you need to create an SSM parameter in AWS
System Managers parameter store (https://us-west-2.console.aws.amazon.com/systems-manager/parameters/)
holding the connection string (URL). The key needs to be `/db/mongo-db-url-dev`
where `dev` should match the deployment stage determined when deploying animl-api.
The connection string should have the form:

    ```
    mongodb+srv://<db_username>:<db_password>@cluster0.********.mongodb.net/animl-dev?retryWrites=true&w=majority
    ```

    After setting up your Mongo instance and adding the connection string to parameter
    store, you will need to seed your DB which can be found [here](../README.md#seeding-db).

2. In the next step, we need to create a User pool in AWS Cognito. The whole setup
is managed by an AWS  Cloudformation template ```userpool.yml``` that creates and
manages all of the resources related to Auth. To deploy this stack you need to
run this command with the proper permissions enabled:

    ```
    aws cloudformation deploy --template-file userpool.yml  --stack-name animl-user-pool --parameter-overrides Name=animl-dev UsePreauth=false --capabilities CAPABILITY_NAMED_IAM
    ```

    This deployment will also add the necessary SSM parameter that the API will reference.
    Be sure to create versions for all envs you plan on deploying.

3. At this point, we are ready to install the Animl API (https://github.com/tnc-ca-geo/animl-api).
The Animl API is the centerpiece of the application as it stores incoming data, triggers
image inference, and serves the data to the frontend. But when deploying a new animl-api
instance, you will have to comment out all SSM params prefixed by `ml/` in the
[config.ts](../src/config/config.ts). Even with these changes, animl-api will not
be functional until after animl-ingest has been deployed. If your AWS credentials
are stored as a profile, it should be as simple as running:

    ```
    npm run deploy-dev
    ```

4. In order for animl-api to function, it requires [animl-ingest](https://github.com/tnc-ca-geo/animl-ingest#dev-deployment)
to be deployed as well, but it requires animl-api to be deployed first due to the
api key being a requirement. As with animl-api, if your AWS credentials are stored
as a profile, it should be as simple as running:

    ```
    serverless deploy --stage dev
    ```

5. In order for animl-ingest to work, we need to deploy our [exif-api](https://github.com/tnc-ca-geo/exif-api#deploy-cloudformation-template-manually)
to extract data from the images. After this service has been deployed, animl-api can be minimally tested by putting
an image in the image ingestion S3 bucket. This should trigger the image to be
ingested and processed without any ML inference, but an image record should be
created in the MongoDB instance.

6. Next, we need to deploy animl-frontend, which will also allow us to more easily
test the entire system. Before deploying though, we need to update `API_URLS` with
the new API Gateway url and `AWS_AUTH_CONFIG` with the new Cognito configs in the
[config.js](https://github.com/tnc-ca-geo/animl-frontend/blob/main/src/config.js).
After that is done, the instructions to deploy a new frontend with its own URL
can be found [here](https://github.com/tnc-ca-geo/animl-frontend?tab=readme-ov-file#steps-to-deploy-new-instance-of-animl-frontend).

7. To fully utilize the functionality of Animl, we need to deploy ML models to
run inference on incoming images. The instructions for models we have deployed
before can be found [here](https://github.com/tnc-ca-geo/animl-ml#deploying-a-new-model).
After deploying the model, you will have to update the stack at various points in order to utilize it:
    - create new SSM parameter for each ML Model endpoint
    - add the new SSM parameter to the `ssmNames` in config.ts in the animl-api project and redeploy it
    - create a record for the new ML Model in the `mlmodels` collection in MongoDB
    - add the new ML Model to `availableMlModels` for each project you wish to use the model in MongoDB
