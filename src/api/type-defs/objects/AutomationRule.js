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
    _id: ID!
    name: String!
    event: AutomationEvent!
    action: AutomationAction!
  }
`;
