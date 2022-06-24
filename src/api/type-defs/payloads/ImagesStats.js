module.exports = `
  type ReviewedCount {
    reviewed: Int!
    notReviewed: Int!
  }

  type ReviewerStats {
    userId: ID!
    reviewedCount: Int!
  }
  
  type ImagesStats {
    imageCount: Int!
    reviewedCount: ReviewedCount!
    reviewerList: [ReviewerStats]!
  }
`;
