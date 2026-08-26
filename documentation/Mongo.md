### Setting up MongoDB

1. Subscribe to the `MongoDB Atlas (pay-as-you-go)` service in the AWS console via
the AWS Marketplace (e.g. https://us-east-1.console.aws.amazon.com/marketplace/search).
Search for `MongoDb Atlas` and create a subscription according to your preferences.
After creating a subscription, a link `Setup your account` will take you to the
vendor's website (https://account.mongodb.com/).

2. Follow the `Don't have a MongoDB account yet?` [Sign up](https://account.mongodb.com/account/register) to complete linking your AWS account to MongoDB, and you have to confirm your account via email.

3. Create an organization within the MongoDB Atlas service by viewing your `Organizations`
and clicking `Create New Organizaion` and choosing the `MongoDB Atlas` cloud service.
Next step would be to link your newly created organization to your AWS account
for billing, and we recommend linking them via the AWS Marketplace.

4. Create a new project by going to `All Projects` and clicking `New Project`.
From there, you should just need to name your project.

5. Create a new cluster instance in your newly created project to be used for record
storage. At this point you will need to choose the cluster plan depending on how
heavy usage you are expecting. We recommend starting with the free tier to test
and monitor your usage before upgrading to a higher tier at a later date. Currently
the [animl.camera](https://animl.camera/) instance runs on the M30 plan. At this
stage you must also choose which cloud provider and region you wish to deploy your
cluster to, and we curretly only support AWS deployments to the `us-west-2` region.

6. Creation of the cluster will automatically create an admin `DB User` with a role already assigned. Please don't use this DB User for connecting the application to the database. Rather create a new `DB User` with a custom role. Start by creating a custom role with these permissions(assuming your database is named animl-dev) which you can access via your projects settings by following this path `Security` -> `Database & Network Access` -> `Custom Role`:
    ```
    enableProfiler @animl-dev(all collections)
    dropDatabase @animl-dev(all collections)
    renameCollectionSameDB @animl-dev(all collections)
    dbStats @animl-dev(all collections)
    listCollections @animl-dev(all collections)
    read@animl-dev
    readWrite@animl-dev
    dbAdmin@animl-dev
    ```


7. After this custom role is created, go to these settings here `Security` -> `Database & Network Access`
-> `Database Users` to create a unique DB User for animl-api to access the database with password as the Authentication Method. Attach the custom role you created to this new user and note down this new user's name and password for the next step.

    ![Project Screenshot](images/mongo-auth-method.png)

    **Please note that a `DB User` is distinct from a Mongo DB Atlas user, although the first DB User automatically created is named after your MongoDB Atlas username. A `DB User` is a set of credentials to access a database in your cluster, whereas the latter is to access your MongoDB Atlas account which can have access to multiple organizations or clusters.**

8. You can now write the connection string of the newly created `DB User` to AWS Systems Manager Parameter Store with this name `/db/mongo-db-url-dev`. The connection string is a url directed at your MongoDB cluster that will allow animl-api to query and write to the appropriate database. To access the connection string, click on the `Connect` button from the cluster overview page, and choose the `Compass` option. When you click `I have MongoDB Compass installed`, the second step should have your connection string. Then replace the `db_username` and `db_password` with the credentials from the DB User created in the previous step. It should look something like this:

    ```
    mongodb+srv://<db_username>:<db_password>@cluster0.********.mongodb.net/
    ```

    Then you should also add the database name provided in the custom role to the connection string to direct animl-api to the specific database, `animl-dev` in our example. We also recommend adding these url parameters to the connection string `retryWrites=true&w=majority`. So the full connection string should look like this:

    ```
    mongodb+srv://developer:********@cluster0.********.mongodb.net/animl-dev?retryWrites=true&w=majority
    ```

9. Enable IP address access to your DB in your projects settings via `Security` -> `Database & Network Access` -> `IP Access List`. To test the connectivity you can enable your specific IP address, but to fully deploy an animl instance, you will need to enable all IPs  by adding `0.0.0.0/0` to your `IP Access List` (this is what we currently do,
but we can relook at this in the future).

10. At this point you can now test the DB and its connectivity by seeding the DB via [seedDb.js](../src/scripts/seedDb.js) script,
which can be run by the instructions [here](../README.md#seeding-db). In order to do this, we need to edit the
[config.js](../src/config/config.ts) and comment out all the SSM Parameters that are not the MongoDB conenction string.
This script will help create some example projects and the records for some example ML Models.
