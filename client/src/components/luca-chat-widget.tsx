import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bot, MessageCircle } from "lucide-react";
import { AIAgentChat } from "./ai-agent-chat";

export function LucaChatWidget() {
  const [isOpen, setIsOpen] = useState(false);

  // Custom floating trigger button
  const floatingButton = (
    <Button
      size="lg"
      className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl z-50 hover:scale-110 transition-all duration-300 animate-pulse hover:animate-none"
      data-testid="button-open-luca-chat"
    >
      <Bot className="h-6 w-6" />
      <span className="sr-only">Open Luca AI Assistant</span>
    </Button>
  );

  return (
    <div className="luca-chat-widget">
      <AIAgentChat
        agentName="luca"
        trigger={floatingButton}
        mode="dialog"
      />
    </div>
  );
}
