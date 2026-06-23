import React from 'react';

/**
 * Parses inline markdown like **bold**, *italic*, and `code` into React nodes.
 */
function parseInlineMarkdown(text: string): React.ReactNode[] {
  // Split by bold (**), italic (*), and inline code (`) markdown boundaries
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={idx}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code 
          key={idx} 
          style={{ 
            background: 'rgba(255, 255, 255, 0.1)', 
            padding: '2px 4px', 
            borderRadius: '4px', 
            fontFamily: 'monospace',
            fontSize: '90%'
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

/**
 * Parses multi-line markdown text (headers, lists, inline formatting) into React elements.
 */
export const renderMarkdown = (text: string): React.ReactNode => {
  if (!text) return null;

  const lines = text.split('\n');

  return (
    <>
      {lines.map((line, lineIdx) => {
        // 1. Check for headers (e.g., ### Header)
        const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (headerMatch) {
          const level = headerMatch[1].length;
          const content = headerMatch[2];
          const parsedContent = parseInlineMarkdown(content);
          const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
          
          // Style headers based on level
          const fontSize = level === 1 ? '1.4em' : level === 2 ? '1.25em' : '1.1em';
          return (
            <Tag 
              key={lineIdx} 
              style={{ 
                margin: '12px 0 6px 0', 
                fontWeight: 700, 
                fontSize,
                color: 'var(--text-primary)'
              }}
            >
              {parsedContent}
            </Tag>
          );
        }

        // 2. Check for bullet points (e.g., * Item or - Item)
        const listMatch = line.match(/^[\*\-]\s+(.*)$/);
        if (listMatch) {
          const content = listMatch[1];
          const parsedContent = parseInlineMarkdown(content);
          return (
            <li 
              key={lineIdx} 
              style={{ 
                marginLeft: '16px', 
                listStyleType: 'disc', 
                margin: '4px 0 4px 16px',
                lineHeight: '1.5'
              }}
            >
              {parsedContent}
            </li>
          );
        }

        // 3. Spacing for empty lines
        if (line.trim() === '') {
          return <div key={lineIdx} style={{ height: '8px' }} />;
        }

        // 4. Standard text paragraph
        return (
          <p key={lineIdx} style={{ margin: '4px 0', lineHeight: '1.5' }}>
            {parseInlineMarkdown(line)}
          </p>
        );
      })}
    </>
  );
};
