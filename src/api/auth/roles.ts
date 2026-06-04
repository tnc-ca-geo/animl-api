const MANAGER = 'project_manager';
const MEMBER = 'project_member';
// const OBSERVER = 'project_observer';

const EXPORT_DATA_ROLES = [MANAGER, MEMBER]; // export annotation data
const WRITE_OBJECTS_ROLES = [MANAGER, MEMBER]; // review images
const WRITE_VIEWS_ROLES = [MANAGER, MEMBER]; // create views
const WRITE_COMMENTS_ROLES = [MANAGER, MEMBER]; // write comments
const READ_TASKS_ROLES = [MANAGER, MEMBER]; // read tasks
const WRITE_PROJECT_ROLES = [MANAGER]; // manage project settings, labels, and tags
const WRITE_IMAGES_ROLES = [MANAGER, MEMBER]; // upload images
const DELETE_IMAGES_ROLES = [MANAGER]; // delete images
const MANAGE_USERS_ROLES = [MANAGER]; // create users and assign roles
const WRITE_DEPLOYMENTS_ROLES = [MANAGER]; // create deployments
const WRITE_AUTOMATION_RULES_ROLES = [MANAGER]; // create automation rules
const WRITE_CAMERA_REGISTRATION_ROLES = [MANAGER]; // register wireless cameras
const WRITE_CAMERA_SERIAL_NUMBER_ROLES = [MANAGER]; // update camera serial number
const WRITE_DELETE_CAMERA_ROLES = [MANAGER]; // delete cameras
const WRITE_TAGS_ROLES = [MANAGER, MEMBER]; // apply tags to images

export {
  READ_TASKS_ROLES,
  WRITE_COMMENTS_ROLES,
  DELETE_IMAGES_ROLES,
  EXPORT_DATA_ROLES,
  MANAGE_USERS_ROLES,
  WRITE_PROJECT_ROLES,
  WRITE_OBJECTS_ROLES,
  WRITE_VIEWS_ROLES,
  WRITE_IMAGES_ROLES,
  WRITE_DEPLOYMENTS_ROLES,
  WRITE_AUTOMATION_RULES_ROLES,
  WRITE_CAMERA_REGISTRATION_ROLES,
  WRITE_CAMERA_SERIAL_NUMBER_ROLES,
  WRITE_DELETE_CAMERA_ROLES,
  WRITE_TAGS_ROLES,
};
