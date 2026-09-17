export type CertificateSource = "ai" | "upload";
export type CertificateStatus = "pending" | "approved" | "rejected";

export type CertificateSummary = {
  id: string;
  code: string;
  skillId: string | null;
  skillName: string;
  title: string;
  holderName: string;
  score: number;
  level: string;
  skills: string[];
  verifier: string;
  assessmentType: string;
  source: CertificateSource;
  status: CertificateStatus;
  isPublic: boolean;
  issuedAt: string;
  expiresAt: string;
  reviewNotes: string | null;
  reviewedAt: string | null;
};

export type PendingCertificateReview = {
  id: string;
  code: string;
  skillId: string | null;
  skillName: string;
  holderName: string;
  title: string;
  status: CertificateStatus;
  fileUrl: string | null;
  createdAt: string;
  reviewNotes: string | null;
};

export const MAX_CERTIFICATE_FILE_BYTES = 10 * 1024 * 1024; // 10MB
export const ACCEPTED_CERTIFICATE_TYPES = ["application/pdf", "image/png", "image/jpeg"];

/** Public shape for the /verify/$id and /certificates/$id pages — only approved+public rows reach this. */
export type PublicCertificate = {
  id: string; // certificate `code`
  title: string;
  holder: string;
  issued: string;
  expires: string;
  score: number;
  level: string;
  skills: string[];
  verifier: string;
  assessmentType: string;
};
