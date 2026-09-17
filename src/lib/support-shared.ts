export type TicketStatus = "open" | "in_progress" | "escalated" | "closed";
export type TicketPriority = "low" | "medium" | "high";

export type SupportTicketSummary = {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  userId: string;
  userName: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

export type SupportMessage = {
  id: string;
  authorId: string;
  isAdmin: boolean;
  message: string;
  createdAt: string;
};

export type SupportTicketDetail = SupportTicketSummary & {
  messages: SupportMessage[];
};
