const { ApolloError } = require('apollo-server-errors');
const { SES } = require('aws-sdk');
const { buildImgUrl } = require('../api/db/models/utils');

const ses = new SES({apiVersion: '2010-12-01'});

const makeEmail = (rule, image, config) => {
  const imageUrl = buildImgUrl(image, config);
  const body = `HTML email with embedded image. \
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
        Data: `${rule.event.label} detected on camera ${image.cameraSn}`
      }
    }, 
    Source: config.EMAIL_ALERT_SENDER, 
  };
};

const sendEmail = async (rule, image, config) => {
  try {
    console.log(`Sending alert for ${image.originalFileName}`);
    const email = makeEmail(rule, image, config);
    const res = await ses.sendEmail(email).promise();
    return res;
  } catch (err) {
    throw new ApolloError(err);
  }
};

module.exports = {
  sendEmail,
};
