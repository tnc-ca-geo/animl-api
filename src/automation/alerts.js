const { ApolloError } = require('apollo-server-errors');
const { SES } = require('aws-sdk');
const { buildImgUrl } = require('../api/db/models/utils');

const ses = new SES({ apiVersion: '2010-12-01' });

const buildFrontendUrl = (image, config) => {
  const url = config['/FRONTEND/URL'];
  return `https://${url}/?img=${image._id}`;
};

const makeEmail = async (rule, image, context) => {

  console.log(`alerts.makeEmail() - rule: ${rule}`);
  const frontendUrl = buildFrontendUrl(image, context.config)
  const imageUrl = buildImgUrl(image, context.config);

  try {

    let deployment;
    const projects = await context.models.Project.getProjects([image.project]);
    const project = projects[0];
    for (const cam of project.cameras) {
      for (const dep of cam.deployments) {
        if (dep._id.toString() === image.deployment.toString()) deployment = dep;
      };
    };

    const body = 
      `<a href=${frontendUrl}>View image in Animl</a>\
      <img src="${imageUrl}" alt="detected ${rule.event.label}"/>`
  
    return {
      Destination: {
        ToAddresses: rule.action.alertRecipients,
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
      Source: context.config['EMAIL_ALERT_SENDER'], 
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
