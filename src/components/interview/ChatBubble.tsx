import type { InterviewChatMessage } from "@/lib/interview-shared";
import { useTypewriter } from "./useTypewriter";

export function ChatBubble({
  message,
  animate = false,
}: {
  message: InterviewChatMessage;
  animate?: boolean;
}) {
  const isUser = message.role === "user";
  const revealed = useTypewriter(message.content, animate && !isUser);

  return (
    <div
      className={`max-w-[85%] rounded-2xl p-4 text-sm shadow-soft ${
        isUser
          ? "ml-auto bg-gradient-brand text-primary-foreground"
          : "border border-border/70 bg-card"
      }`}
    >
      <p className="whitespace-pre-wrap leading-relaxed">{isUser ? message.content : revealed}</p>
    </div>
  );
}
