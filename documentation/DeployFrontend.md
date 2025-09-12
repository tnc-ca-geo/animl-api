# Steps to Deploy animl-frontend

1. Register your domain in AWS Route 53 or your own domain registry
   - if registered in Route 53, then create a Hosted Zone using the same domain name. After the Hosted Zone is created, ensure the `ns` entry matches the name servers in the registered domain.
2. Create a public certificate in AWS Certificate Manager with the same domain name, and any other subdomains you wish.
   - in order to validate the certificate, make sure to either create the corresponding DNS entries in the Route 53 Hosted Zone created in step 1 or your own DNS
3. Once the certificate is sucessfully validated and provisioned(this can take up to 24 hours), copy the ARN of the certificate and add it to the serverless.yaml file as the `AcmCertificateArn`.
4. Add the registered domain name and subdomains in the serverless.yaml file as the `Aliases`.
5. Deploy the animl-frontend code to AWS s3 and creating the corresponding AWS Cloudfront Distribution by running `npm run deploy-dev` in the root directory of the frontend repo.
