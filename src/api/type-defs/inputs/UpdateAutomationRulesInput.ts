export default /* GraphQL */ `
  input AutomationEventInput {
    type: String!
    label: String
  }

  input AutomationActionInput {
    type: String!
    mlModel: String
    alertRecipients: [String!]
    confThreshold: Float
    categoryConfig: JSONObject
  }

  input AutomationRuleInput {
    _id: ID
    name: String!
    event: AutomationEventInput!
    action: AutomationActionInput!
  }

  input UpdateAutomationRulesInput {
    automationRules: [AutomationRuleInput!]!
  }
`;
