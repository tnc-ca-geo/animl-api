const jwt = require('jwt-simple');

const BEARER_TOKEN_PATTERN = /^Bearer [-_=.0-9a-zA-Z]+$/i;

async function getUserInfo(req, config) {
    const token = req.headers.Authorization || req.headers.authorization;
    const api_key = req.headers['x-api-key'];
    // TODO AUTH - if we will now be passing project into so many queries/mutations, 
    // maybe it makes sense to pass project in as a GraphQL input variable 
    // instead of as a header?
    const project = req.headers['project'];

    // if x-api-key header is present, call was to /internal path
    // and was made by an internal lambda
    if (api_key == config['APIKEY']) {
      // return { 'cognito:groups': ['animl_superuser'] };
      return { 'is_superuser': true };
    }

    if (!token || !BEARER_TOKEN_PATTERN.test(token) || !project) {
      return null;
    }

    // else, call was made to /external (from the UI), so decode the user's 
    // access token
    let user = jwt.decode(
        token.substring('Bearer '.length), // Everything after the Bearer prefix.
        null, // Secret doesn't matter since the APIG verifies.
        true // API Gateway handles verification, so we don't.
    );

    // parse cognito groups into projects
    const projects = user['cognito:groups'].reduce((projects, group) => {
      const groupComponents = group.split('/');
      if (groupComponents.length !== 3) return projects;
      const proj = groupComponents[1];
      const role = groupComponents[2];
      if (projects[proj]) {
        projects[proj].roles.push(role);
      }
      else {
        projects[proj] = { roles: [role] };
      }
      return projects;
    }, {});

    // TODO AUTH - how to handle 'default' project access? Who needs it? 
    // whatever role is creating images will need it. does anyone else?
    // superuser will be creating images and creating labels. Anything else?
    user['is_superuser'] = user['cognito:groups'].includes('animl_superuser');
    user['projects'] = projects;
    user['curr_project'] = project; 
    user['curr_project_roles'] = projects[project] 
      ? projects[project].roles 
      : null;

    return (user['is_superuser'] || user['curr_project_roles']) ? user : null;

}

module.exports = {
    getUserInfo,
};
