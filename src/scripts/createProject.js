// TODO: use client-cognito-identity-provider to automatically create cognito groups
// https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cognito-identity-provider/index.html
async function createNewProject(params) {
  const { dbModels, newProjectConfig, context } = params;

  const existingProjects = await dbModels.Project.getProjects({}, context);
  const existingProjIds = existingProjects.map((proj) => proj._id);
  console.log('Found existing projects: ', existingProjIds);

  const newProjectRecords = [];
  for (const project of newProjectConfig) {
    if (!existingProjIds.includes(project._id)) {
      try {
        const newProjectRecord = await dbModels.Project.createProject(project);
        newProjectRecords.push(newProjectRecord);
      } catch (err) {
        throw new ApolloError(err);
      }
    } else {
      console.log(`${project._id} already exists!`);
    }
  }

  console.log('Successfully created new Project records: ', newProjectRecords);
  return newProjectRecords;
}
