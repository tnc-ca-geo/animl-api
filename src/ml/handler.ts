import { GraphQLClient, gql } from 'graphql-request';
import { type Detection, modelInterfaces } from './modelInterfaces.js';
import { type Config, getConfig } from '../config/config.js';
import { type GraphQLError } from 'graphql';
import { type IAutomationRule } from '../api/db/schemas/Project.js';
import { buildCatConfig } from '../automation/utils.js';
import * as gqlTypes from '../@types/graphql.js';

interface GetProjectResponse {
  projects: Array<{
    automationRules: Array<Pick<IAutomationRule, '_id' | 'action'>>;
  }>;
}

  const GET_PROJECT_RULE = gql`
  query GetProject($projectId: String!) {
    projects(input: { _ids: [$projectId] }) {
      automationRules {
        _id
        name
        event {
          type
          label
        }
        action {
          type
          alertRecipients
          mlModel
          confThreshold
          categoryConfig
        }
      }
    }
  }
`;

async function requestCreateInternalLabels(
  input: { labels: Detection[] },
  config: Config,
): Promise<gqlTypes.StandardPayload> {
  const variables = { input: input };
  const mutation = gql`
    mutation CreateInternalLabels($input: CreateInternalLabelsInput!) {
      createInternalLabels(input: $input) {
        isOk
      }
    }
  `;

  const graphQLClient = new GraphQLClient(config['/API/URL'], {
    headers: { 'x-api-key': config['APIKEY'] },
  });

  return await graphQLClient.request(mutation, variables);
}

async function singleInference(config: Config, record: Record): Promise<void> {
  const { modelSource, image, label, projectId, automationRuleId } = JSON.parse(record.body);

  console.log(`message related to image ${image._id}: ${record.body}`);

  // Create GraphQL client
  const graphQLClient = new GraphQLClient(config['/API/URL'], {
    headers: { 'x-api-key': config['APIKEY'] },
  });

  // Fetch project and find specific rule
  const response = await graphQLClient.request<GetProjectResponse>(GET_PROJECT_RULE, { projectId });
  console.log('response: ', response);
  const project = response.projects[0];
  console.log('project: ', project);
  const rule = project.automationRules.find((r) => r._id.toString() === automationRuleId);
  console.log('rule: ', rule);
  if (!rule) throw new Error(`Automation rule ${automationRuleId} not found`);

  // Convert categoryConfig from JSON to Map for buildCatConfig
  rule.action.categoryConfig = new Map(Object.entries(rule.action.categoryConfig || {}));
  const catConfig = buildCatConfig(modelSource, rule);

  // run inference
  if (modelInterfaces.has(modelSource._id)) {
    const requestInference = modelInterfaces.get(modelSource._id)!;

    const detections = await requestInference({
      modelSource,
      catConfig,
      image,
      label,
      config,
    });

    // if successful, make create label request
    if (detections.length) {
      try {
        await requestCreateInternalLabels(
          {
            labels: detections.map((det) => ({ ...det, imageId: image._id })),
          },
          config,
        );
      } catch (err) {
        console.log(`requestCreateInternalLabels() ERROR on image ${image._id}: ${err}`);
        // don't fail messages that produce duplicate label errors
        // Note: hacky JSON parsing below due to odd error objects created by graphql-request client
        // https://github.com/jasonkuhrt/graphql-request/issues/201
        const errParsed = JSON.parse(JSON.stringify(err));
        const hasDuplicateLabelErrors = errParsed.response.errors.some(
          (e: GraphQLError) => e.extensions.code === 'DUPLICATE_LABEL',
        );
        if (!hasDuplicateLabelErrors) {
          throw err;
        }
      }
    }
  } else {
    // TODO: gracefully handle model not found
  }
}

async function inference(event: InferenceEvent): Promise<InferenceOutput> {
  const config = await getConfig();

  console.log('event: ', event);

  const batchItemFailures: InferenceOutput['batchItemFailures'] = [];
  if (!event.Records || !event.Records.length) {
    return { batchItemFailures };
  }

  const results = await Promise.allSettled(
    event.Records.map((record) => {
      return singleInference(config, record);
    }),
  );

  console.log('results: ', results);

  for (let i = 0; i < results.length; i++) {
    if (results[i].status !== 'rejected') continue;

    batchItemFailures.push({
      itemIdentifier: event.Records[i].messageId,
    });
  }

  if (batchItemFailures.length > 0) {
    console.log('ERROR - batchItemFailures: ', batchItemFailures);
  }

  return { batchItemFailures };
}

export { inference };

interface Record {
  messageId: string;
  body: string;
}
interface InferenceEvent {
  Records: Record[];
}
interface InferenceOutput {
  batchItemFailures: Array<{ itemIdentifier: string }>;
}
