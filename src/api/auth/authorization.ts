import jwt from 'jwt-simple';
import { Config } from '../../config/config.js';

const BEARER_TOKEN_PATTERN = /^Bearer [-_=.0-9a-zA-Z]+$/i;

async function getUserInfo(req: AWSLambda.APIGatewayProxyEvent, config: Config) {
  const token = req.headers.Authorization || req.headers.authorization;
  const api_key = req.headers['x-api-key'];

  // if x-api-key header is present, call was to /internal path
  // and was made by an internal lambda
  if (api_key === config['APIKEY']) {
    return {
      aud: 'internal',
      is_superuser: true,
    };
  }

  if (!token || !BEARER_TOKEN_PATTERN.test(token)) {
    return null;
  }

  // else, call was made to /external (from the UI),
  // so decode the user's access token
  const user = jwt.decode(
    token.substring('Bearer '.length), // Everything after the Bearer prefix
    '', // Secret doesn't matter since the APIG verifies
    true, // API Gateway handles verification, so we don't
  );

  // add selected project info to user
  const selectedProject = req.headers['x-selected-project'] || '';
  user['curr_project'] = selectedProject;

  // parse cognito groups into projects
  user['projects'] = [];
  if (user['cognito:groups']) {
    const projects = user['cognito:groups'].reduce((projects: User['projects'], group: string) => {
      const groupComponents = group.split('/');
      if (groupComponents.length !== 3) return projects;

      const proj = groupComponents[1];
      const role = groupComponents[2];
      if (projects[proj]) {
        projects[proj].roles.push(role);
      } else {
        projects[proj] = { roles: [role] };
      }
      return projects;
    }, {});

    user['is_superuser'] = user['cognito:groups'].includes('animl_superuser');
    user['projects'] = projects;
    user['curr_project_roles'] = projects[selectedProject] ? projects[selectedProject].roles : [];
  }

  return user;
}

// TODO: Build out interface further...
export interface User {
  sub: string;
  aud: string;
  'cognito:username': string;
  is_superuser: boolean;
  curr_project: string | null;
  projects: Record<string, { roles: string[] }>;
  curr_project_roles: string[];
}

export { getUserInfo };
