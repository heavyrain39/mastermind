import { ReactNode } from "react";

interface ScrollAreaProps {
  children: ReactNode;
  className?: string;
}

export function ScrollArea({ children, className = "" }: ScrollAreaProps) {
  return <div className={`scroll-area ${className}`.trim()}>{children}</div>;
}

