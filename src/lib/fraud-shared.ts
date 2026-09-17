export type DuplicateCertificateSignal = {
  userId: string;
  userName: string;
  skillId: string;
  skillName: string;
  count: number;
};

export type RepeatedFailureSignal = {
  userId: string;
  userName: string;
  skillId: string;
  skillName: string;
  failedCount: number;
};

export type FlaggedAttemptSignal = {
  attemptId: string;
  userId: string;
  userName: string;
  skillName: string;
  reason: string | null;
  flaggedAt: string;
};

export type FraudSignals = {
  duplicateCertificates: DuplicateCertificateSignal[];
  repeatedFailures: RepeatedFailureSignal[];
  flaggedAttempts: FlaggedAttemptSignal[];
};
