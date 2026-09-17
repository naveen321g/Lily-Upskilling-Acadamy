export type AdminNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  targetType: string | null;
  targetId: string | null;
  isRead: boolean;
  createdAt: string;
};
