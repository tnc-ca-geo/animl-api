const { SES } = require('aws-sdk');
const config = require('../config/config');

const ses = new SES({apiVersion: '2010-12-01'});

const makeEmail = (rule, image) => {
  const imageUrl = config.ANIML_IMAGES_URL + 'images/' + image.hash + '.jpg';
  const body = `HTML email with embedded image. \
  <img src="${imageUrl}" alt="detected ${rule.label}"/>`

  return {
    Destination: {
      ToAddresses: [rule.alertRecipient],
    }, 
    Message: {
      Body: {
        Html: { Charset: 'UTF-8', Data: body },
      }, 
      Subject: {
        Charset: 'UTF-8', 
        Data: `${rule.label} detected on camera ${cameraSn}`
      }
    }, 
    Source: config.EMAIL_ALERT_SENDER, 
  };
};

const sendEmail = async (rule, image) => {
  try {
    const email = makeEmail(rule, image);
    const res = await ses.sendEmail(email).promise();
  } catch (err) {
    throw new Error(err);
  }
};

module.exports = {
  sendEmail,
};
