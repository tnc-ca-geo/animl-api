import mongoose, { HydratedDocument, HydratedSingleSubdocument } from 'mongoose';
import { TaskModel } from './Task.js';
import GraphQLError, {
  AuthenticationError,
  InternalServerError,
  NotFoundError,
  DeleteLabelError,
  ForbiddenError,
  DBValidationError,
} from '../../errors.js';
import { DateTime } from 'luxon';
import Project, {
  AutomationRuleSchema,
  CameraConfigSchema,
  IAutomationRule,
  ProjectLabelSchema,
  ProjectSchema,
  ProjectTagSchema,
  ViewSchema,
} from '../schemas/Project.js';
import { UserModel } from './User.js';
import { ImageModel } from './Image.js';
import Image, { ImageSchema } from '../schemas/Image.js';
import { sortDeps, idMatch, BaseAuthedModel, MethodParams, roleCheck } from './utils.js';
import { MLModelModel } from './MLModel.js';
import retry from 'async-retry';
import {
  WRITE_PROJECT_ROLES,
  WRITE_DEPLOYMENTS_ROLES,
  WRITE_VIEWS_ROLES,
  WRITE_AUTOMATION_RULES_ROLES,
} from '../../auth/roles.js';
import { Context } from '../../handler.js';
import * as gql from '../../../@types/graphql.js';
import { TaskSchema } from '../schemas/Task.js';

// The max number of labeled images that can be deleted
// when removing a label from a project
const MAX_LABEL_DELETE = 500;

const ObjectId = mongoose.Types.ObjectId;

export class ProjectModel {
  static async queryById(_id: string) {
    const query = { _id: { $eq: _id } };
    try {
      const project = await Project.findOne(query);
      if (!project) throw new NotFoundError('Project not found');

      return project;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async getProjects(
    input: Maybe<gql.QueryProjectsInput> | undefined,
    context: Pick<Context, 'user'>,
  ): Promise<HydratedDocument<ProjectSchema>[]> {
    console.log('Project.getProjects - input: ', input);
    let query = {};
    if (context.user['is_superuser']) {
      query = input?._ids ? { _id: { $in: input._ids } } : {};
    } else {
      const availIds = Object.keys(context.user['projects']);
      const filteredIds = input?._ids && input._ids.filter((_id) => availIds.includes(_id));
      query = { _id: { $in: filteredIds || availIds } };
    }

    try {
      const projects = await Project.find(query);
      return projects;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async createProject(
    input: gql.CreateProjectInput,
    context: Pick<Context, 'user' | 'config'>,
  ): Promise<HydratedDocument<ProjectSchema>> {
    if (!context.user['cognito:username']) {
      // If projects are created by a "machine" user they will end up orphaned
      // in that no users will have permission to see the project
      throw new AuthenticationError('Projects must be created by an authenticated user');
    }

    if (!input.availableMLModels.length)
      throw new DBValidationError('At least 1 MLModel must be enabled for a project');
    const models = (
      await MLModelModel.getMLModels({
        _ids: input.availableMLModels,
      })
    ).map((model) => {
      return model._id;
    });

    for (const m of input.availableMLModels) {
      if (!models.includes(m)) throw new DBValidationError(`${m} is not a valid model identifier`);
    }

    try {
      const _id = input.name
        .toLowerCase()
        .replace(/\s/g, '_')
        .replace(/[^0-9a-z_]/gi, '');

      const project = await retry(
        async () => {
          const newProject = new Project({
            ...input,
            _id,
            views: [
              {
                _id: new ObjectId(),
                name: 'All images',
                filters: {},
                description: 'Default view of all images. This view is not editable.',
                editable: false,
              },
            ],
          });
          await newProject.save();
          return newProject;
        },
        { retries: 2 },
      );

      await UserModel.createGroups({ name: _id }, context);

      context.user['curr_project'] = _id;

      await UserModel.update(
        {
          username: context.user['cognito:username'],
          roles: ['manager'] as gql.UserRole[],
        },
        context,
      );

      return project;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async updateProject(
    input: gql.UpdateProjectInput,
    context: Pick<Context, 'user'>,
  ): Promise<HydratedDocument<ProjectSchema>> {
    try {
      const project = await this.queryById(context.user['curr_project']!);

      Object.assign(project, input);

      await project.save();

      return project;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async createCameraConfig(
    input: { projectId: string; cameraId: string },
    context: Pick<Context, 'user'>,
  ): Promise<HydratedDocument<ProjectSchema>> {
    console.log('Project.createCameraConfig - input: ', input);
    const { projectId, cameraId } = input;
    try {
      return await retry(
        async () => {
          let project = await Project.findOne({ _id: projectId });
          if (!project) throw new NotFoundError('Project not found');
          console.log('originalProject: ', project);

          const newCamConfig = {
            _id: cameraId,
            deployments: [
              {
                _id: new mongoose.Types.ObjectId(),
                name: 'default',
                timezone: project.timezone,
                description: 'This is the default deployment. It is not editable',
                editable: false,
              },
            ],
          };

          // NOTE: using findOneAndUpdate() with an aggregation pipeline to update
          // Projects to preserve atomicity of the operation and avoid race conditions
          // during bulk upload image ingestion.
          // https://github.com/tnc-ca-geo/animl-api/issues/112
          const updatedProject = await Project.findOneAndUpdate(
            { _id: projectId },
            [
              { $addFields: { camIds: '$cameraConfigs._id' } },
              {
                $set: {
                  cameraConfigs: {
                    $cond: {
                      if: { $in: [cameraId, '$camIds'] },
                      then: '$cameraConfigs',
                      else: { $concatArrays: ['$cameraConfigs', [newCamConfig]] },
                    },
                  },
                },
              },
            ],
            { returnDocument: 'after' },
          );

          console.log('updatedProject: ', updatedProject);

          if (updatedProject!.cameraConfigs.length > project.cameraConfigs.length) {
            console.log(
              "Couldn't find a camera config with that _id, so added one to project: ",
              updatedProject,
            );
          }

          return updatedProject!;
        },
        { retries: 2 },
      );
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async createView(
    input: gql.CreateViewInput,
    context: Pick<Context, 'user'>,
  ): Promise<HydratedSingleSubdocument<ViewSchema>> {
    try {
      return await retry(
        async () => {
          // find project, add new view, and save
          const [project] = await ProjectModel.getProjects(
            { _ids: [context.user['curr_project']!] },
            context,
          );
          const newView = {
            _id: new ObjectId(),
            name: input.name,
            filters: input.filters,
            ...(input.description && { description: input.description }),
            editable: input.editable,
          };
          project.views.push(newView);
          const updatedProj = await project.save();
          return updatedProj.views.find(
            (v): v is HydratedSingleSubdocument<ViewSchema> => v.name === newView.name,
          )!;
        },
        { retries: 2 },
      );
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async updateView(
    input: gql.UpdateViewInput,
    context: Pick<Context, 'user'>,
  ): Promise<HydratedSingleSubdocument<ViewSchema>> {
    try {
      return await retry(
        async (bail) => {
          // find view
          const [project] = await ProjectModel.getProjects(
            { _ids: [context.user['curr_project']!] },
            context,
          );
          const view = project.views.find((v) => idMatch(v._id!, input.viewId))!;
          if (!view.editable) {
            bail(new ForbiddenError(`View ${view?.name} is not editable`));
          }

          // appy updates & save project
          Object.assign(view, input.diffs);
          const updatedProj = await project.save();
          return updatedProj.views.find((v): v is HydratedSingleSubdocument<ViewSchema> =>
            idMatch(v._id!, input.viewId),
          )!;
        },
        { retries: 2 },
      );
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async deleteView(
    input: gql.DeleteViewInput,
    context: Pick<Context, 'user'>,
  ): Promise<HydratedDocument<ProjectSchema>> {
    try {
      return await retry(
        async (bail) => {
          // find view
          const [project] = await ProjectModel.getProjects(
            { _ids: [context.user['curr_project']!] },
            context,
          );
          const view = project.views.find((v) => idMatch(v._id!, input.viewId));
          if (!view?.editable) {
            bail(new ForbiddenError(`View ${view?.name} is not editable`));
          }

          // remove view from project and save
          project.views = project.views.filter(
            (v) => !idMatch(v._id!, input.viewId),
          ) as mongoose.Types.DocumentArray<ViewSchema>;
          return project.save();
        },
        { retries: 2 },
      );
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async updateAutomationRules(
    { automationRules }: gql.UpdateAutomationRulesInput,
    context: Pick<Context, 'user'>,
  ): Promise<mongoose.Types.DocumentArray<AutomationRuleSchema>> {
    try {
      return await retry(
        async () => {
          console.log('attempting to update automation rules with: ', automationRules);
          const [project] = await ProjectModel.getProjects(
            { _ids: [context.user['curr_project']!] },
            context,
          );
          project.automationRules =
            automationRules as any as mongoose.Types.DocumentArray<IAutomationRule>;
          await project.save();
          return project.automationRules;
        },
        { retries: 2 },
      );
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  // NOTE: this function is only called as part of CRUD ops on deployments,
  // or if we are merging one camera into another in updateCameraSerialNumber,
  // all of which are themselves called by the async task handler
  static async reMapImagesToDeps({
    projId,
    camConfig,
  }: {
    projId: string;
    camConfig: HydratedDocument<CameraConfigSchema>;
  }) {
    try {
      console.time('reMapImagesToDeps');
      await retry(
        async () => {
          // build array of operations from camConfig.deployments:
          // for each deployment, build filter, build update, then perform bulkWrite
          // NOTE: this function expects deps to be in chronological order!
          const operations = [];
          for (const [index, dep] of camConfig.deployments.entries()) {
            const createdStart = dep.startDate || null;
            const createdEnd = camConfig.deployments[index + 1]
              ? camConfig.deployments[index + 1].startDate
              : null;

            const filter: Record<any, any> = { projectId: projId, cameraId: camConfig._id };
            if (createdStart || createdEnd) {
              filter.dateTimeOriginal = {
                ...(createdStart && { $gte: createdStart }),
                ...(createdEnd && { $lt: createdEnd }),
              };
            }

            for await (const img of Image.find(filter)) {
              const update: Partial<ImageSchema> = {};
              if (img.deploymentId.toString() !== dep._id!.toString()) {
                update.deploymentId = dep._id;
              }

              if (img.timezone !== dep.timezone) {
                const dtOriginal = DateTime.fromJSDate(img.dateTimeOriginal as any as Date).setZone(
                  img.timezone,
                );
                const newDT = dtOriginal.setZone(dep.timezone, { keepLocalTime: true });
                update.dateTimeOriginal = newDT.toJSDate();
                update.timezone = dep.timezone;
              }

              if (Object.entries(update).length > 0) {
                const op = {
                  updateOne: { filter: { _id: img._id }, update },
                };
                operations.push(op);
              }
            }
          }
          await Image.bulkWrite(operations);
        },
        { retries: 3 },
      );
      console.timeEnd('reMapImagesToDeps');
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async createDeploymentTask(
    input: gql.CreateDeploymentInput,
    context: Pick<Context, 'user' | 'config'>,
  ): Promise<HydratedDocument<TaskSchema>> {
    try {
      return await TaskModel.create(
        {
          type: 'CreateDeployment',
          projectId: context.user['curr_project'],
          user: context.user.sub,
          config: input,
        },
        context,
      );
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  // NOTE: this function is called by the async task handler
  static async createDeployment(
    input: gql.CreateDeploymentInput,
    context: Pick<Context, 'user'>,
  ): Promise<HydratedSingleSubdocument<CameraConfigSchema>> {
    try {
      const { cameraId, deployment } = input;
      const { project, camConfig } = await retry(
        async () => {
          // find camera config
          const [project] = await ProjectModel.getProjects(
            { _ids: [context.user['curr_project']!] },
            context,
          );
          const camConfig = project.cameraConfigs.find((cc) => idMatch(cc._id, cameraId));
          if (!camConfig) throw new NotFoundError('Camera config not found');

          // add new deployment, sort them, and save project
          camConfig.deployments.push(deployment);
          camConfig.deployments = sortDeps(camConfig!.deployments);
          await project.save();
          return { project, camConfig };
        },
        { retries: 2 },
      );
      // TODO: we need to reverse the above operation if reMapImagesToDeps fails!
      await ProjectModel.reMapImagesToDeps({ projId: project._id, camConfig });
      return camConfig;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async updateDeploymentTask(
    input: gql.UpdateDeploymentInput,
    context: Pick<Context, 'user' | 'config'>,
  ): Promise<HydratedDocument<TaskSchema>> {
    try {
      return await TaskModel.create(
        {
          type: 'UpdateDeployment',
          projectId: context.user['curr_project'],
          user: context.user.sub,
          config: input,
        },
        context,
      );
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  // NOTE: this function is called by the async task handler
  static async updateDeployment(
    input: gql.UpdateDeploymentInput,
    context: Pick<Context, 'user'>,
  ): Promise<HydratedDocument<CameraConfigSchema>> {
    const { cameraId, deploymentId, diffs } = input;
    try {
      const { project, camConfig } = await retry(
        async (bail) => {
          // find deployment
          const [project] = await ProjectModel.getProjects(
            { _ids: [context.user['curr_project']!] },
            context,
          );
          const camConfig = project.cameraConfigs.find((cc) => idMatch(cc._id, cameraId));
          if (!camConfig) throw new NotFoundError('Camera config not found');
          const deployment = camConfig!.deployments.find((dep) => idMatch(dep._id!, deploymentId));
          if (deployment!.name === 'default') {
            bail(new ForbiddenError(`View ${deployment!.name} is not editable`));
          }

          // apply updates, sort deployments, and save project
          Object.assign(deployment!, diffs);
          camConfig.deployments = sortDeps(camConfig.deployments);
          await project.save();
          return { project, camConfig };
        },
        { retries: 2 },
      );
      // TODO: we need to reverse the above operation if reMapImagesToDeps fails!
      if (Object.keys(input.diffs).includes('startDate')) {
        await ProjectModel.reMapImagesToDeps({ projId: project._id, camConfig });
      }
      return camConfig;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async deleteDeploymentTask(
    input: gql.DeleteDeploymentInput,
    context: Pick<Context, 'user' | 'config'>,
  ): Promise<HydratedDocument<TaskSchema>> {
    try {
      return await TaskModel.create(
        {
          type: 'DeleteDeployment',
          projectId: context.user['curr_project'],
          user: context.user.sub,
          config: input,
        },
        context,
      );
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  // NOTE: this function is called by the async task handler
  static async deleteDeployment(
    { cameraId, deploymentId }: gql.DeleteDeploymentInput,
    context: Pick<Context, 'user'>,
  ): Promise<HydratedDocument<CameraConfigSchema>> {
    try {
      const { project, camConfig } = await retry(
        async () => {
          // find camera config
          const [project] = await ProjectModel.getProjects(
            { _ids: [context.user['curr_project']!] },
            context,
          );
          const camConfig = project.cameraConfigs.find((cc) => idMatch(cc._id, cameraId))!;

          // filter out deployment, sort remaining ones, and save project
          camConfig.deployments = sortDeps(
            camConfig!.deployments.filter((dep) => !idMatch(dep._id!, deploymentId)),
          );

          await project.save();
          return { project, camConfig };
        },
        { retries: 2 },
      );
      // TODO: we need to reverse the above operation if reMapImagesToDeps fails!
      await ProjectModel.reMapImagesToDeps({ projId: project._id, camConfig });
      return camConfig;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async createTag(
    input: gql.CreateProjectTagInput,
    context: Pick<Context, 'user'>,
  ): Promise<{ tags: mongoose.Types.DocumentArray<ProjectTagSchema> }> {
    try {
      const project = await this.queryById(context.user['curr_project']!);

      if (
        project.tags.filter((tag) => {
          return tag.name.toLowerCase() === input.name.toLowerCase();
        }).length
      ) {
        throw new DBValidationError(
          'A tag with that name already exists, avoid creating tags with duplicate names',
        );
      }

      project.tags.push(input);

      await project.save();

      return { tags: project.tags };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async createLabel(
    input: gql.CreateProjectLabelInput,
    context: Pick<Context, 'user'>,
  ): Promise<HydratedDocument<gql.ProjectLabel>> {
    try {
      const project = await this.queryById(context.user['curr_project']!);

      if (
        project.labels.filter((label) => {
          return label.name.toLowerCase() === input.name.toLowerCase();
        }).length
      )
        throw new DBValidationError(
          'A label with that name already exists, avoid creating labels with duplicate names',
        );

      project.labels.push(input);

      await project.save();

      return project.labels.pop()!;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async deleteLabel(
    input: gql.DeleteProjectLabelInput,
    context: Pick<Context, 'user'>,
  ): Promise<gql.StandardPayload> {
    try {
      const project = await this.queryById(context.user['curr_project']!);

      const label = project.labels?.find((p) => p._id.toString() === input._id.toString());
      if (!label) throw new DeleteLabelError('Label not found on project');

      const count = await ImageModel.countImagesByLabel([input._id], context);

      if (count > MAX_LABEL_DELETE) {
        const msg =
          `This label is already in extensive use (>${MAX_LABEL_DELETE} images) and cannot be ` +
          ' automatically deleted. Please contact nathaniel[dot]rindlaub@tnc[dot]org to request that it be manually deleted.';
        throw new DeleteLabelError(msg);
      }

      await ImageModel.deleteAnyLabels(
        {
          labelId: input._id,
        },
        context,
      );

      project.labels.splice(project.labels.indexOf(label), 1);

      const views = project.views.map((view) => {
        if (!Array.isArray(view.filters.labels)) return view;

        return {
          ...view,
          filters: {
            ...view.filters,
            labels: view.filters.labels.filter((label) =>
              project.labels.some((l) => l._id === label),
            ),
          },
        };
      });
      project.views = views as typeof project.views;

      await project.save();

      return { isOk: true };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async updateLabel(
    input: gql.UpdateProjectLabelInput,
    context: Pick<Context, 'user'>,
  ): Promise<HydratedDocument<ProjectLabelSchema>> {
    try {
      const project = await this.queryById(context.user['curr_project']!);

      const label = project.labels.find((p) => p._id.toString() === input._id.toString());
      if (!label) throw new NotFoundError('Label not found on project');
      if (label.ml === true && input.name !== label.name) {
        throw new ForbiddenError('Cannot update the name of a ML label');
      }

      Object.assign(label, input);

      await project.save();

      return label;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }
}

export default class AuthedProjectModel extends BaseAuthedModel {
  getProjects(...args: MethodParams<typeof ProjectModel.getProjects>) {
    return ProjectModel.getProjects(...args);
  }

  createProject(...args: MethodParams<typeof ProjectModel.createProject>) {
    return ProjectModel.createProject(...args);
  }

  @roleCheck(WRITE_PROJECT_ROLES)
  deleteLabel(...args: MethodParams<typeof ProjectModel.deleteLabel>) {
    return ProjectModel.deleteLabel(...args);
  }

  @roleCheck(WRITE_PROJECT_ROLES)
  createTag(...args: MethodParams<typeof ProjectModel.createTag>) {
    return ProjectModel.createTag(...args);
  }

  @roleCheck(WRITE_PROJECT_ROLES)
  createLabel(...args: MethodParams<typeof ProjectModel.createLabel>) {
    return ProjectModel.createLabel(...args);
  }

  @roleCheck(WRITE_PROJECT_ROLES)
  updateLabel(...args: MethodParams<typeof ProjectModel.updateLabel>) {
    return ProjectModel.updateLabel(...args);
  }

  @roleCheck(WRITE_PROJECT_ROLES)
  updateProject(...args: MethodParams<typeof ProjectModel.updateProject>) {
    return ProjectModel.updateProject(...args);
  }

  @roleCheck(WRITE_VIEWS_ROLES)
  createView(...args: MethodParams<typeof ProjectModel.createView>) {
    return ProjectModel.createView(...args);
  }

  @roleCheck(WRITE_VIEWS_ROLES)
  updateView(...args: MethodParams<typeof ProjectModel.updateView>) {
    return ProjectModel.updateView(...args);
  }

  @roleCheck(WRITE_VIEWS_ROLES)
  deleteView(...args: MethodParams<typeof ProjectModel.deleteView>) {
    return ProjectModel.deleteView(...args);
  }

  @roleCheck(WRITE_AUTOMATION_RULES_ROLES)
  updateAutomationRules(...args: MethodParams<typeof ProjectModel.updateAutomationRules>) {
    return ProjectModel.updateAutomationRules(...args);
  }

  @roleCheck(WRITE_DEPLOYMENTS_ROLES)
  createDeployment(...args: MethodParams<typeof ProjectModel.createDeploymentTask>) {
    return ProjectModel.createDeploymentTask(...args);
  }

  @roleCheck(WRITE_DEPLOYMENTS_ROLES)
  updateDeployment(...args: MethodParams<typeof ProjectModel.updateDeploymentTask>) {
    return ProjectModel.updateDeploymentTask(...args);
  }

  @roleCheck(WRITE_DEPLOYMENTS_ROLES)
  deleteDeployment(...args: MethodParams<typeof ProjectModel.deleteDeploymentTask>) {
    return ProjectModel.deleteDeploymentTask(...args);
  }
}
