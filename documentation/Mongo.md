### Setting up MongoDB

1. Subscribe to the `MongoDB Atlas (pay-as-you-go)` service in your AWS console, and register an account by following the instructions.

2. Create an organization and link it to your AWS account for billing, and can also link it via the AWS console.

3. Create a new cluster instance to be used for record storage. At this point you will need to choose the cluster
plan depending on how heavy usage you are expecting.

4. Create DB users to access the instance. The first user you create will automatically have a role assigned,
but might not have the most permissions enabled. So there needs to be a new user with a custom role, and the
custom role will need these permissions(assuming your database is named animl-dev):
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

5. Enable IP address access to your DB in the "Database & Network Access" settings. To test the connectivity you can enable your specific IP address, but to fully deploy an animl instance, you will need to enable all IPs  by adding `0.0.0.0/0` to your `IP Access List` (this is what we currently do,
but we can relook at this in the future).

6. For this DB you can now write the connection string to AWS Systems Manager Parameter Store with this name `/db/mongo-db-url-dev`. We also recommend adding these url parameters to the connection string `retryWrites=true&w=majority`. Ex:
```
mongodb+srv://developer:*******@cluster0.********.mongodb.net/animl-dev?retryWrites=true&w=majority
```

7. At this point you can now test the DB and its connectivity by seeding the DB via [seedDb.js](../src/scripts/seedDb.js) script,
which can be run by the instructions [here](../README.md#seeding-db). In order to do this, we need to edit the
[config.js](../src/config/config.ts) and comment out all the SSM Parameters that are not the MongoDB conenction string.
This script will help create some example projects and the records for some example ML Models.
