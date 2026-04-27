import React from "react";
import { ExternalLink } from "lucide-react";
import type { Components } from "react-markdown";

/**
 * Shared react-markdown component overrides used across the chat surfaces
 * (Chats page, ConversationPanel, ChatComparisonPanel).
 *
 * Includes styled renderers for GFM tables and blockquotes so that numeric
 * "calculation snapshot" answers from the AI render like the design spec:
 *  - Bold title (rendered by **bold** above the table)
 *  - 2-column Label / Value table with thin row dividers
 *  - Optional blockquote callout with left side-bar
 */
export const chatMarkdownComponents: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline inline-flex items-center gap-1"
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  ),
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-none space-y-1 my-2">{children}</ul>,
  li: ({ children }) => (
    <li className="flex items-start gap-2">
      <span>•</span>
      <span>{children}</span>
    </li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),

  // GFM Tables — styled to match the "Loan Snapshot" design
  table: ({ children }) => (
    <div className="my-3 w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: () => null, // Hide header row — design uses Label/Value implicitly
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-t border-border first:border-t-0">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="text-left font-medium text-muted-foreground py-3 pr-4">
      {children}
    </th>
  ),
  td: ({ children, node }) => {
    // First cell = label (left, muted), subsequent cells = value (right, semibold)
    const parent = node?.parent as any;
    const idx = parent?.children?.filter((c: any) => c.type === "element").indexOf(node);
    const isLabel = idx === 0;
    return (
      <td
        className={
          isLabel
            ? "text-left text-muted-foreground py-3 pr-4 align-top"
            : "text-right font-semibold text-foreground py-3 pl-4 align-top"
        }
      >
        {children}
      </td>
    );
  },

  // Blockquote — callout with left side-bar (matches the "PMI is not required" note)
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-4 border-muted-foreground/30 bg-muted/40 px-4 py-2 text-foreground rounded-r-md [&>p]:mb-0">
      {children}
    </blockquote>
  ),
};