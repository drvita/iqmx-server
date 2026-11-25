'use client';

import React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

const MENTION_REGEX = /(^|[\s([{"'¿¡])(@[a-zA-Z0-9][a-zA-Z0-9._-]{0,48})/g;

function highlightStringMentions(text: string, keyPrefix: string): React.ReactNode {
  MENTION_REGEX.lastIndex = 0;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let matchIdx = 0;

  while ((match = MENTION_REGEX.exec(text)) !== null) {
    const lead = match[1];
    const mention = match[2];
    const matchStart = match.index;
    const mentionStart = matchStart + lead.length;

    if (mentionStart > lastIndex) {
      parts.push(text.slice(lastIndex, mentionStart));
    }

    const isAll = mention.toLowerCase() === '@all';
    parts.push(
      <span
        key={`${keyPrefix}-m-${matchIdx++}`}
        className={
          isAll
            ? 'inline-flex items-center rounded px-1.5 py-0.5 text-[0.85em] font-semibold bg-amber-50 text-amber-800 border border-amber-200'
            : 'inline-flex items-center rounded px-1.5 py-0.5 text-[0.85em] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80'
        }
      >
        {mention}
      </span>
    );

    lastIndex = mentionStart + mention.length;
  }

  if (lastIndex === 0) {
    return text;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function highlightMentions(node: React.ReactNode, keyPrefix = 'root'): React.ReactNode {
  if (typeof node === 'string') {
    return highlightStringMentions(node, keyPrefix);
  }
  if (Array.isArray(node)) {
    return node.map((child, idx) => (
      <React.Fragment key={`${keyPrefix}-${idx}`}>
        {highlightMentions(child, `${keyPrefix}-${idx}`)}
      </React.Fragment>
    ));
  }
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    if (node.type === 'code' || node.type === 'pre' || node.type === 'a') {
      return node;
    }
    if (node.props && node.props.children !== undefined) {
      return React.cloneElement(node, {
        ...node.props,
        children: highlightMentions(node.props.children, `${keyPrefix}-c`),
      });
    }
  }
  return node;
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mt-4 mb-2 first:mt-0 text-base font-bold text-gray-900 tracking-tight">
      {highlightMentions(children, 'h1')}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-3.5 mb-1.5 first:mt-0 text-[15px] font-bold text-gray-900 tracking-tight">
      {highlightMentions(children, 'h2')}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1 first:mt-0 text-sm font-bold text-gray-900">
      {highlightMentions(children, 'h3')}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-2.5 mb-1 first:mt-0 text-xs font-bold uppercase tracking-wide text-gray-700">
      {highlightMentions(children, 'h4')}
    </h4>
  ),
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 leading-relaxed text-gray-800">
      {highlightMentions(children, 'p')}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 last:mb-0 list-disc pl-5 space-y-1 text-gray-800 [&_ul]:mt-1 [&_ul]:mb-0 [&_ol]:mt-1 [&_ol]:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 last:mb-0 list-decimal pl-5 space-y-1 text-gray-800 [&_ul]:mt-1 [&_ul]:mb-0 [&_ol]:mt-1 [&_ol]:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">
      {highlightMentions(children, 'li')}
    </li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900">
      {highlightMentions(children, 'strong')}
    </strong>
  ),
  em: ({ children }) => (
    <em className="italic">
      {highlightMentions(children, 'em')}
    </em>
  ),
  del: ({ children }) => (
    <del className="line-through text-gray-500">
      {highlightMentions(children, 'del')}
    </del>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-3 border-blue-300 bg-blue-50/40 pl-3 py-1.5 text-gray-700 italic rounded-r">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-gray-200" />,
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100 font-mono leading-relaxed">
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className && className.includes('language-'));
    if (isBlock) {
      return (
        <code className={`${className} font-mono text-xs`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[0.85em] text-gray-800 border border-gray-200/70"
        {...props}
      >
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-xs text-left">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gray-50 text-gray-700 font-semibold">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-gray-100 bg-white">{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-xs font-semibold text-gray-700 whitespace-nowrap">
      {highlightMentions(children, 'th')}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-xs text-gray-700 align-top">
      {highlightMentions(children, 'td')}
    </td>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 underline hover:text-blue-800 break-words"
    >
      {children}
    </a>
  ),
};

type ForumMarkdownProps = {
  content: string;
  className?: string;
};

export default function ForumMarkdown({ content, className = 'text-sm' }: ForumMarkdownProps) {
  return (
    <div className={`min-w-0 break-words ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
