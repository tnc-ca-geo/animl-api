module.exports = `
  type AutomationEvent {
    type: String!
    label: String
  }

  type AutomationAction {
    type: String!
    model: ID
    alertRecipients: [String]
  }

  type AutomationRule {
    _id: ID!
    name: String!
    event: AutomationEvent!
    action: AutomationAction!
  }
`;
