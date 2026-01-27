const buildCatConfig = (modelSource, rule) => {
  return modelSource.categories.map((cs) => {
    const { _id, name } = cs;
    const catConfig = rule.action.categoryConfig && rule.action.categoryConfig.get(name);
    // for confidence threshold, priorize the automation rule / category-level
    // setting if it exists, else use the model source's default setting
    const ct = (catConfig && catConfig.confThreshold) || modelSource.defaultConfThreshold;
    const disabled = (catConfig && catConfig.disabled) || false;
    return { _id, name, disabled, confThreshold: ct };
  });
};

const ruleApplies = (rule, event, label, project) => {
  if (rule.event.type === event) {
    if (rule.event.type === 'image-added') {
      return true;
    }
    if (rule.event.type === 'label-added') {
      const projectLabel = project.labels.find((pl) => {
        return pl._id.toString() === label.labelId.toString();
      });

      // Check for direct label match
      if (rule.event.label.toLowerCase() === projectLabel?.name.toLowerCase()) {
        return true;
      }

      // Check for taxonomy match
      if (
        projectLabel?.taxonomy &&
        projectLabel.taxonomy.toLowerCase().split(';').includes(rule.event.label.toLowerCase())
      ) {
        return true;
      }
    }
  }
  return false;
};

const buildCallstack = async (payload, context) => {
  const { event, image, label } = payload;
  const [project] = await context.models.Project.getProjects({ _ids: [image.projectId] }, context);
  const callstack = project.automationRules.filter((rule) =>
    ruleApplies(rule, event, label, project),
  );
  return callstack;
};

export { buildCatConfig, buildCallstack };
