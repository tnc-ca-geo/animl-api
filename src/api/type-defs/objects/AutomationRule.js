module.exports = `
  type AutomationEvent {
    type: String!
    label: String
  }

  type AutomationAction {
    type: String!
    model: ID
    alertRecipient: String
  }

  type AutomationRule {
    event: AutomationEvent!
    action: AutomationAction!
  }
`;
