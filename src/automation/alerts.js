const { ApolloError } = require('apollo-server-errors');
const { SES } = require('aws-sdk');
const { buildImgUrl, idMatch } = require('../api/db/models/utils');

const ses = new SES({ apiVersion: '2010-12-01' });

const buildFrontendUrl = async (image, project, config) => {
    const url = config['/FRONTEND/URL'];
    const projId = image.projectId;
    const viewId = project.views.find((v) => v.name === 'All images')._id;
    return `https://${url}/${projId}/${viewId}?img=${image._id}`;
};

const makeEmail = async (rule, image, context) => {

    try {
        const projId = image.projectId;
        const [project] = await context.models.Project.getProjects([projId]);
        const frontendUrl = await buildFrontendUrl(image, project, context.config);
        const imageUrl = buildImgUrl(image, context.config, 'medium');

        let deployment;
        for (const camConfig of project.cameraConfigs) {
            for (const dep of camConfig.deployments) {
                if (idMatch(dep._id, image.deploymentId)) {
                    deployment = dep;
                }
            }
        }

        const body =
      '<div>' +
        `<a href=${frontendUrl}>View image in Animl</a>` +
      '</div>' +
      '<div>' +
        `<img src="https://${imageUrl}" alt="detected ${rule.event.label}"/>` +
      '</div>';

        return {
            Destination: {
                ToAddresses: rule.action.alertRecipients
            },
            Message: {
                Body: {
                    Html: { Charset: 'UTF-8', Data: body }
                },
                Subject: {
                    Charset: 'UTF-8',
                    Data: `${rule.event.label} detected at ${deployment.name}`
                }
            },
            Source: context.config['EMAIL_ALERT_SENDER']
        };
    } catch (err) {
        throw new ApolloError(err);
    }
};

const sendEmail = async (rule, image, context) => {
    try {
        const email = await makeEmail(rule, image, context);
        const res = await ses.sendEmail(email).promise();
        return res;
    } catch (err) {
        throw new ApolloError(err);
    }
};

module.exports = {
    sendEmail
};
