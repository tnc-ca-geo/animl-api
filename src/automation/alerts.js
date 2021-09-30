const { ApolloError } = require('apollo-server-errors');
const { SES } = require('aws-sdk');
const { buildImgUrl } = require('../api/db/models/utils');

const ses = new SES({apiVersion: '2010-12-01'});

const buildFrontendUrl = (image, config) => {
  return `https://${config.ANIML_FRONTEND_URL}/?img=${image._id}`
};

const makeEmail = async (rule, image, context) => {
  try {
    const frontendUrl = buildFrontendUrl(image, context.config)
    const imageUrl = buildImgUrl(image, context.config);
    const camera = await context.models.Camera.getCameras([image.cameraSn]);
    const deployment = camera[0].deployments.find((dep) => (
      dep._id.toString() === image.deployment.toString()
    ));
    const body = 
      `<a href=${frontendUrl}>View image in Animl</a>\
      <img src="${imageUrl}" alt="detected ${rule.event.label}"/>`
  
    return {
      Destination: {
        ToAddresses: [rule.action.alertRecipient],
      }, 
      Message: {
        Body: {
          Html: { Charset: 'UTF-8', Data: body },
        }, 
        Subject: {
          Charset: 'UTF-8', 
          Data: `${rule.event.label} detected at ${deployment.name}`
        }
      }, 
      Source: context.config.EMAIL_ALERT_SENDER, 
    };
  } catch (err) {
    throw new ApolloError(err);
  }
};

const sendEmail = async (rule, image, context) => {
  try {
    console.log(`Sending alert for ${image.originalFileName}`);
    const email = await makeEmail(rule, image, context);
    const res = await ses.sendEmail(email).promise();
    return res;
  } catch (err) {
    throw new ApolloError(err);
  }
};

module.exports = {
  sendEmail,
};
