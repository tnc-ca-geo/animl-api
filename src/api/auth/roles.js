const MANAGER = 'project_manager';
const MEMBER = 'project_member';
// const OBSERVER = 'project_observer';

const EXPORT_DATA_ROLES =                [MANAGER, MEMBER];
const WRITE_OBJECTS_ROLES =              [MANAGER, MEMBER];
const WRITE_VIEWS_ROLES =                [MANAGER, MEMBER];
const WRITE_IMAGES_ROLES =               [MANAGER];
const WRITE_DEPLOYMENTS_ROLES =          [MANAGER];
const WRITE_AUTOMATION_RULES_ROLES =     [MANAGER];
const WRITE_CAMERA_REGISTRATION_ROLES =  [MANAGER];

module.exports = {
  EXPORT_DATA_ROLES,
  WRITE_OBJECTS_ROLES,
  WRITE_VIEWS_ROLES,
  WRITE_IMAGES_ROLES,
  WRITE_DEPLOYMENTS_ROLES,
  WRITE_AUTOMATION_RULES_ROLES,
  WRITE_CAMERA_REGISTRATION_ROLES
};
