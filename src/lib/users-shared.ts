export type AdminUserSummary = {
  id: string;
  email: string;
  fullName: string | null;
  roles: string[];
  createdAt: string;
  bannedUntil: string | null;
  skillsVerified: number;
  attemptsCount: number;
  certificatesCount: number;
};

export type AdminUserSkill = {
  skillId: string;
  skillName: string;
  status: string;
  score: number;
  trust: number;
  verifications: string[];
};

export type AdminUserAttempt = {
  id: string;
  skillName: string;
  level: string;
  status: string;
  score: number | null;
  passed: boolean | null;
  startedAt: string;
};

export type AdminUserCertificate = {
  id: string;
  code: string;
  title: string;
  status: string;
  source: string;
  issuedAt: string;
};

export type AdminUserBadge = {
  id: string;
  skillId: string;
  skillName: string;
  type: string;
  status: string;
  issuedAt: string;
};

export type AdminUserDetail = AdminUserSummary & {
  skills: AdminUserSkill[];
  attempts: AdminUserAttempt[];
  certificates: AdminUserCertificate[];
  badges: AdminUserBadge[];
};
