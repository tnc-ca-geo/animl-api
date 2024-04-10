import { GraphQLClient, gql } from "graphql-request";
import {
  type Detection,
  type ModelInterfaceParams,
  modelInterfaces,
} from "./modelInterfaces.js";
import { getConfig } from "../config/config.js";
import { GraphQLError } from "graphql";

async function requestCreateInternalLabels(
  input: requestCreateInternalLabelsInput,
  config: any
) {
  const variables = { input: input };
  const mutation = gql`
    mutation CreateInternalLabels($input: CreateInternalLabelsInput!) {
      createInternalLabels(input: $input) {
        isOk
      }
    }
  `;

  const graphQLClient = new GraphQLClient(config["/API/URL"], {
    headers: { "x-api-key": config["APIKEY"] },
  });

  return await graphQLClient.request(mutation, variables);
}

interface requestCreateInternalLabelsInput {
  labels: Detection[];
}

async function singleInference(config: ModelInterfaceParams, record: Record) {
  const { modelSource, catConfig, image, label } = JSON.parse(record.body);

  console.log(`message related to image ${image._id}: ${record.body}`);

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
          config
        );
      } catch (err) {
        console.log(
          `requestCreateInternalLabels() ERROR on image ${image._id}: ${err}`
        );
        // don't fail messages that produce duplicate label errors
        // Note: hacky JSON parsing below due to odd error objects created by graphql-request client
        // https://github.com/jasonkuhrt/graphql-request/issues/201
        const errParsed = JSON.parse(JSON.stringify(err));
        const hasDuplicateLabelErrors: boolean = errParsed.response.errors.some(
          (e: GraphQLError) => e.extensions.code === "DUPLICATE_LABEL"
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
  const config = (await getConfig()) as any as ModelInterfaceParams; // TODO: Confirm that the is correct

  console.log("event: ", event);

  const batchItemFailures: InferenceOutput["batchItemFailures"] = [];
  if (!event.Records || !event.Records.length) {
    return { batchItemFailures };
  }

  const results = await Promise.allSettled(
    event.Records.map((record) => {
      return singleInference(config, record);
    })
  );

  console.log("results: ", results);

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status !== "rejected") continue;

    batchItemFailures.push({
      itemIdentifier: event.Records[i].messageId,
    });
  }

  if (batchItemFailures.length > 0) {
    console.log("ERROR - batchItemFailures: ", batchItemFailures);
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
