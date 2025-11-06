import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User } from "lucide-react";

interface MentionUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minRows?: number;
  maxRows?: number;
  disabled?: boolean;
}

export function MentionInput({
  value,
  onChange,
  placeholder = "Type @ to mention someone...",
  className,
  minRows = 3,
  maxRows = 10,
  disabled = false,
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: users = [] } = useQuery<MentionUser[]>({
    queryKey: ["/api/mentions/users", searchQuery],
    enabled: showSuggestions,
  });

  const filteredUsers = users.filter(
    (user) =>
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (filteredUsers.length > 0 && selectedIndex >= filteredUsers.length) {
      setSelectedIndex(0);
    }
  }, [filteredUsers.length, selectedIndex]);

  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const cursorPos = textarea.selectionStart;
    setCursorPosition(cursorPos);

    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      const hasSpace = textAfterAt.includes(" ") || textAfterAt.includes("\n");
      
      if (!hasSpace && textAfterAt.length <= 50) {
        setSearchQuery(textAfterAt);
        setShowSuggestions(true);
        setSelectedIndex(0);
        return;
      }
    }
    
    setShowSuggestions(false);
  };

  const insertMention = (user: MentionUser) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const textBeforeCursor = value.substring(0, cursorPosition);
    const textAfterCursor = value.substring(cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    
    if (lastAtIndex === -1) return;

    const beforeMention = value.substring(0, lastAtIndex);
    const mention = `@[${user.id}]`;
    const newValue = beforeMention + mention + " " + textAfterCursor;
    
    onChange(newValue);
    setShowSuggestions(false);
    
    setTimeout(() => {
      const newCursorPos = beforeMention.length + mention.length + 1;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || filteredUsers.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < filteredUsers.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev > 0 ? prev - 1 : filteredUsers.length - 1
        );
        break;
      case "Enter":
        if (showSuggestions) {
          e.preventDefault();
          insertMention(filteredUsers[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowSuggestions(false);
        break;
      case "Tab":
        if (showSuggestions) {
          e.preventDefault();
          insertMention(filteredUsers[selectedIndex]);
        }
        break;
    }
  };

  return (
    <div className="relative w-full">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        rows={minRows}
        data-testid="input-mention-textarea"
      />
      
      {showSuggestions && filteredUsers.length > 0 && (
        <Card className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto" data-testid="mention-suggestions">
          <div className="p-1">
            {filteredUsers.map((user, index) => (
              <button
                key={user.id}
                type="button"
                onClick={() => insertMention(user)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left hover-elevate ${
                  index === selectedIndex ? "bg-accent" : ""
                }`}
                data-testid={`mention-user-${user.id}`}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{user.fullName}</div>
                  <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                </div>
                <div className="text-xs text-muted-foreground capitalize">{user.role}</div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export function displayMentions(text: string, users: MentionUser[]): string {
  let result = text;
  
  users.forEach((user) => {
    const mentionPattern = new RegExp(`@\\[${user.id}\\]`, 'g');
    result = result.replace(mentionPattern, `@${user.fullName}`);
  });
  
  return result;
}

export function extractMentionIds(text: string): string[] {
  const mentionPattern = /@\[([a-zA-Z0-9-]+)\]/g;
  const mentions: string[] = [];
  let match;
  
  while ((match = mentionPattern.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  
  return mentions;
}
