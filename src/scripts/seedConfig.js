import SSM from '@aws-sdk/client-ssm';

/*
 *  Seed DB config
 *
 *  Fetches only the Mongo URL from SSM Parameter Store, mirroring
 *  src/config/config.ts, without depending on the rest of that runtime config.
 */

async function getSeedConfig() {
	const ssm = new SSM.SSMClient({ region: process.env.REGION });
	const paramName = `/db/mongo-db-url-${process.env.STAGE}`;
	const res = await ssm.send(new SSM.GetParameterCommand({
        Name: paramName, WithDecryption: true
    }));
	const mongoDbUri = res.Parameter?.Value;

	if (!mongoDbUri) {
		throw new Error(`Missing SSM parameter ${paramName} for seeding`);
	}

	return { '/DB/MONGO_DB_URL': mongoDbUri };
}

export { getSeedConfig };
