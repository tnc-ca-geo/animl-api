const jwt = require('jwt-simple');

const BEARER_TOKEN_PATTERN = /^Bearer [-_=.0-9a-zA-Z]+$/i;

async function getUserInfo(req, config) {
    const token = req.headers.Authorization || req.headers.authorization;
    const api_key = req.headers['x-api-key'];

    // if x-api-key header is present, call was to /internal path
    // and was made by an internal lambda
    if (api_key == config['APIKEY']) {
      console.log('authorization.getUserInfo() - found api key in header, must be /intenal call');
      return { 'is_superuser': true };
    }

    if (!token || !BEARER_TOKEN_PATTERN.test(token)) {
      console.log('authorization.getUserInfo() - no token found');
      return null;
    }

    console.log('authorization.getUserInfo() - call was made to /external, so decode users access token');

    // else, call was made to /external (from the UI),
    // so decode the user's access token
    let user = jwt.decode(
        token.substring('Bearer '.length), // Everything after the Bearer prefix
        null, // Secret doesn't matter since the APIG verifies
        true // API Gateway handles verification, so we don't
    );

    console.log(`authorization.getUserInfo() - user before parsing: ${JSON.stringify(user)}`);

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

    // TODO AUTH - if we will now be passing project into so many queries/mutations, 
    // maybe it makes sense to pass project in as a GraphQL input variable 
    // instead of as a header?
    
    const selectedProject = req.headers['x-selected-project'] || null;
    user['is_superuser'] = user['cognito:groups'].includes('animl_superuser');
    user['projects'] = projects;
    user['curr_project'] = selectedProject; 
    user['curr_project_roles'] = projects[selectedProject] 
      ? projects[selectedProject].roles 
      : null;

    console.log(`authorization.getUserInfo() - user after parsing: ${JSON.stringify(user)}`);

    return user;

}

module.exports = {
    getUserInfo,
};
