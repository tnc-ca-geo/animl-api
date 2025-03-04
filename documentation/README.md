# Animl architecture

The following documentation describes the data flow and relationships between Animl microservices.

![Animl architecture diagram](/animl-architecture-diagram.png)

### [animl-base](https://github.com/tnc-ca-geo/animl-base)

- Animl Base (1) is a node application deployed on linux-based field computers that ingests new images from a Buckeye wireless camera trap base station and uploads them to S3.

### [animl-email-relay](https://github.com/tnc-ca-geo/animl-email-relay)

- **animl-email-staging -** _S3 bucket_
  - S3 bucket (2) to which SES Receiving rule writes emails sent to [animl@codefornature.org](mailto:animl@codefornature.org) sent by cellular camera traps
- **relayImages -** _Lambda function_
  - Lambda (3) triggered by new objects added to animl-email-staging bucket. Extracts images in cellular camera trap alert email and adds them to animl-images-ingestion bucket. Additionally may scrape a unique identifier for the camera (e.g. serial number) from the email body or subject line and write it to the images’ exifdata before adding it to the ingestion bucket.

### [animl-ingest-api](https://github.com/tnc-ca-geo/animl-ingest-api)

- **animl-ingest-api -** _Lambda function_
  - Lambda-based API (4) to support consuming cellular camera data via POST requests. Currently, the API only supports image payloads sent by Reconyx's servers.

### [exif-api](https://github.com/tnc-ca-geo/exif-api)

- **exif-api -** _Lambda function_
  - Lambda-based API (5) for exiftool. Extracts EXIF metadata from image files.

### [animl-ingest](https://github.com/tnc-ca-geo/animl-ingest)

- **animl-images-ingestion** - _S3 bucket_
  - primary bucket (6) to which individual images get added for ingestion and processing, as well as zip files of images for bulk processing
- **IngestImage** - _Lambda function_
  - Primary image ingestion handler (7), triggered by new objects added to animl-images-ingestion bucket
  - When new objects are image files:
    - Get metadata from exif-api Lambda
    - Calls `CreateImageRecord` (animl-api-graphql mutation)
    - If successful, resizes the image and moves the copies to animl-images-serving bucket. If not, copies to animl-images-dead-letter bucket.
    - Deletes image from ingestion bucket
  - When new object is a zip file (i.e., when users upload a zip file of images for batch processing):
    - Submits a process-batch Batch Job to the BatchZipIngestQueue, which invokes the BatchComputeEnvironment (Fargate), which loads the ingest-zip docker container image from ECR and runs it
- **IngestZip** - _Batch Job_
  - ingest-zip Batch handler (8) is responsible for creating batch-specific resources, extracting the images from the zip file, moving them to the images-ingestion bucket, and then deleting the batch resources when the batch processing is complete. We create separate, temporary SQS queues for inference for bulk uploads of images so that they don’t block real-time inference requests and so that we can track the processing progress of individual bulk uploads and display progress bars to the user.
  - Specifically, the ingest-zip Batch handler creates a new CloudFormation stack (9) consisting of 2 SQS queues (primary and DLQ) and a Cloudwatch Metric Alarm (stack template is defined in `ingest-zip/lib/stack.js` ). It then downloads the .zip from S3, unzips it, and puts the individual images back in the ingestion bucket for ingestion
    - Note: when copying the image to S3, ingest-zip prepends the extracted images’ keys with 'batch-[batchId]'. This is important because it’s how downstream tasks know whether to process the image as an individual, real-time image or as part of a specific batch. When the ingest-image Lambda parses the Key of newly added images, it checks if the Key matches that template, and if so appends the `batchId` to the images' metadata. The `Image.batchId` is later checked in downstream steps to know what SQS queues to submit inference requests to.
  - The Cloudwatch Metric Alarm gets triggered when there are no more messages left in the batch queue, and it sends a message to the animl-ingest-delete SNS topic
  - Note: there is also an IngestZip Lambda function created by our Serverless template, but it doesn’t have a trigger and never gets invoked. TBH I can’t remember exactly why that gets created. Something to do with a limitation of the Serverless templates, perhaps?
- **IngestDelete -** _Lambda function_
  - The ingest-delete Lambda (10) is a subscriber to the animl-ingest-delete SNS topic, so it gets invoked, and it deletes the previously created batch ingestion stack. ingest-delete is also invoked every hour as a cautionary clean-up measure, and it can be invoked via the animl-api when users request stopBatch from the front-end.
- **animl-images-serving** - _S3 bucket_
  - bucket for serving images of three sizes: original, medium, and thumbnails
- **animl-images-dead-letter** - _S3 bucket_
  - bucket for storing images that fail ingestion
- **animl-ingest-delete** - _SNS Topic_

### [animl-api](https://github.com/tnc-ca-geo/animl-api)

- **animl-api-graphql** - _Lambda function_
  - A GraphQL API (11) that serves as the lynchpin for the Animl application and manages the business logic and CRUD operations to a MongoDB Atlas database (12). It has a two paths: an `/external` endpoint that gets called by the animl-frontend UI and is protected by a Cognito authorizer requiring the user's ID token, and an `/internal` endpoint that is called by the animl-api-inference, IngestImage, and other internal Lambda handlers and requires and API key.
    - Note: a full description of the auth strategy can be found here: https://github.com/tnc-ca-geo/animl-api/issues/37
  - Users can configure “Automation Rules” to specify what ML models to request predictions from for their images and under what circumstances - for example, they can create an Automation Rule to request object detections from the MegaDetector model when an image is added to the database, and they could create another to request species-level predictions from a classifier when an “animal” Label is detected and created by MegaDetector.
  - When a new image record is created, the animl-api-graphql hander looks up what Automation Rules are configured for that image’s Project and submits it to the appropriate inference queue (either the inferenceQueue for real-time predictions, or a batch inference queue if the image belongs to a batch/bulk upload)
  - A full list of the supported GraphQL Queries can be found in `src/api/type-defs/root/Query.ts` and a full list of the supported Mutations can be found in `src/api/type-defs/root/Mutation.ts`
- **inferenceQueue** - _SQS queue_
  - Primary SQS queue (13) for real-time inference requests
- **animl-api-inference** - _Lambda function_
  - A Lambda function (14) that pulls real-time inference request messages off of the inferenceQueue SQS queue, requests predictions from the appropriate Sagemaker Serverless endpoint(s), and requests `CreateInternalLabels` from the animl-api-graphql when predictions are returned
- **animl-api-batchinference** - _Lambda function_
  - This Lambda (15) uses the same exact hander code as the real-time inference handler above, the only differences being: it watches for messages in the _batch_ SQS queues, consumes 10 messages at a time instead of 1, and has different reserved concurrency settings so that it can scale out horizontally to make use of 80 concurrent Sagemaker Serveless model endpoints for faster processing of large numbers of images. (The real-time inference Lambda is limited to utilizing 20 concurrent endpoints).
    - Note: a full description of the horizontal scaling approach used to deliver fast, non-blocking processing of batches of images can be found here: https://github.com/tnc-ca-geo/animl-api/issues/101
- **animl-api-task** - _Lambda function_
  - The animl-api-graphql Lambda times out after 30 seconds, so for longer-running tasks that Lambdas are not well suited to support (e.g., situations in which we have to iterate over large numbers of individual records before updating them, or exporting large amounts of data), the animl-api-graphql Lambda will instead send a Task message to the taskQueue, and the actual execution of the task is then handled asynchronously by the animl-api-task Lambda (16), which has a much longer timeout (15 minutes)
    - Note: a full description of the async task handling strategy and examples of long-running tasks can be found here: https://github.com/tnc-ca-geo/animl-api/issues/148
- **taskQueue** - _SQS queue_
  - Queue for long-running task requests
- **animl-exported-data-bucket** - _S3 Bucket_
  - Bucket for writing exported CSVs of image annotation data.

### [animl-ml](https://github.com/tnc-ca-geo/animl-ml)

- A collection of resources to test and deploy computer vision models to SageMaker Serverless Endpoints (17). An example deployment workflow can be found here: https://github.com/tnc-ca-geo/animl-ml/tree/master/api/mirav2

### [animl-frontend](https://github.com/tnc-ca-geo/animl-frontend/)

- **animl-frontend** - _S3 Bucket_
  - A S3 bucket (18) for hosting static React-based frontend app
