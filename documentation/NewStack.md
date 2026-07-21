# Deploying a New Animl Stack

In order to create a new instance of the entire Animl stack, we need to deploy things in a certain order to make sure everything is working properly. Before starting these steps, you must have an AWS account created.

1. A MongoDB cluster instance must exist to manage all the resources needed to run this
API. Once this has been created, a SSM parameter named `/db/mongo-db-url-[env]` must
be created with the MongoDB connection string as its value. To learn more about of how
to setup your MongoDB instance reference the documentation [here](Mongo.md).
After setting up your Mongo instance, you will need to seed your DB which can be found [here](../README.md#seeding-db)

2. We currently depend on this CloudFormation Template Stack that is managed by
[UserPool.yml](../UserPool.yml) that creates and manages all of the resources related
to Auth. To deploy this stack you need to run this command with the proper permissions enabled:

```
aws cloudformation deploy --template-file UserPool.yml  --stack-name animl-user-pool --parameter-overrides Name=animl-dev UsePreauth=false --capabilities CAPABILITY_NAMED_IAM
```

This deployment will also add the necessary SSM parameter that the API will reference.
Be sure to create versions for all envs you plan on deploying.

3. In order for animl-api to function, it requires [animl-ingest](http://github.com/tnc-ca-geo/animl-ingest)
to be deployed as well, but it requires animl-api to be deployed first due to the api key being required.

4. In order for animl-ingest to work, we need to deploy our [exif-api](https://github.com/tnc-ca-geo/exif-api)
to extract data from the images. After this service has been deployed, animl-api can be minimally tested by putting
an image in the image ingestion S3 bucket. This should trigger the image to be ingested and processed without any
ML inference, but an image record should be created in the MongoDB instance.

5. Next, we need to deploy animl-frontend, which will also allow us to more easily test the entire system. Before deploying though, we need to update `API_URLS` with the new API Gateway url and `AWS_AUTH_CONFIG` with the new Cognito configs in the [config.js](https://github.com/tnc-ca-geo/animl-frontend/blob/main/src/config.js). After that is done, the instructions to deploy a new frontend with its own URL can be found [here](https://github.com/tnc-ca-geo/animl-frontend?tab=readme-ov-file#steps-to-deploy-new-instance-of-animl-frontend).

6. To fully utilize the functionality of Animl, we need to deploy ML models to reun inference on incoming images.