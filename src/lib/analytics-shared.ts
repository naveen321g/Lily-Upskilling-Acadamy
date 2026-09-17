export type MonthlyPoint = { label: string; value: number };
export type SkillPopularity = { skillName: string; attempts: number };
export type CategoryScore = { category: string; avgScore: number; attempts: number };
export type CertificateStatusCounts = { approved: number; pending: number; rejected: number };
export type BadgeDistribution = {
  aiVerified: number;
  certificateVerified: number;
  fullyVerified: number;
};

export type AnalyticsSummary = {
  totalUsers: number;
  userGrowth: MonthlyPoint[];
  totalAssessments: number;
  passRate: number;
  popularSkills: SkillPopularity[];
  categoryScores: CategoryScore[];
  certificates: CertificateStatusCounts;
  badges: BadgeDistribution;
  fullyVerifiedBustlers: number;
};
