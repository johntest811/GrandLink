import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface SimpleHtmlProps {
  html: string;
  style?: any;
}

/**
 * Simple HTML-to-React-Native text parser
 * Supports: <b>, <strong>, <i>, <em>, <br>, <p>, <span>
 * Handles basic inline styles
 */
export const SimpleHtmlParser: React.FC<SimpleHtmlProps> = ({ html, style }) => {
  if (!html) return null;

  // Strip HTML tags but preserve text and basic formatting info
  const parseHtml = (content: string) => {
    const parts: React.ReactNode[] = [];
    let key = 0;

    // Replace line breaks
    let processedHtml = content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<p[^>]*>/gi, '');

    // Simple regex to find tags and text
    const tagRegex = /(<[^>]+>)|([^<]+)/g;
    let match;
    let boldStack: boolean[] = [];
    let italicStack: boolean[] = [];

    while ((match = tagRegex.exec(processedHtml)) !== null) {
      const fullMatch = match[0];
      const textContent = match[2];

      if (fullMatch.startsWith('</')) {
        // Closing tag
        const tagName = fullMatch.match(/\/(\w+)/)?.[1]?.toLowerCase();
        if (tagName === 'b' || tagName === 'strong') boldStack.pop();
        if (tagName === 'i' || tagName === 'em') italicStack.pop();
      } else if (fullMatch.startsWith('<')) {
        // Opening tag
        const tagName = fullMatch.match(/<(\w+)/)?.[1]?.toLowerCase();
        if (tagName === 'b' || tagName === 'strong') boldStack.push(true);
        if (tagName === 'i' || tagName === 'em') italicStack.push(true);
      } else if (textContent && textContent.trim()) {
        // Text content
        const isBold = boldStack.length > 0;
        const isItalic = italicStack.length > 0;
        parts.push(
          <Text
            key={key++}
            style={[
              isBold && styles.bold,
              isItalic && styles.italic,
            ]}
          >
            {textContent}
          </Text>
        );
      }
    }

    return parts.length > 0 ? parts : null;
  };

  return (
    <Text style={[styles.text, style]}>
      {parseHtml(html)}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
});
