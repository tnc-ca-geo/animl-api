@echo off
set STAGE=prod
set AWS_PROFILE=animl
set REGION=us-west-2
node ./src/scripts/analyzeMLObjectLevel.js
