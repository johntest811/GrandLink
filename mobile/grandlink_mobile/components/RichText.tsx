import React from 'react';
import { StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

interface RichTextProps {
    html?: string | null;
    baseStyle?: TextStyle;
    containerStyle?: ViewStyle;
}

/**
 * A simple RichText component that renders basic HTML tags in React Native.
 * Supports: <b>, <strong>, <i>, <em>, <br>, <p>
 */
const RichText: React.FC<RichTextProps> = ({ html, baseStyle, containerStyle }) => {
    if (!html) return null;

    // Cleanup HTML and split by tags
    const processHtml = (content: string) => {
        // Basic tag replacement for line breaks
        // Replace <br> with newline and handle <p> tags
        const cleaned = content
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<p>/gi, '');

        // Split by tags, keeping the tags in the array
        const parts = cleaned.split(/(<[^>]+>)/g);

        let isBold = false;
        let isItalic = false;

        return parts.map((part, index) => {
            const lowerPart = part.toLowerCase();

            if (lowerPart === '<b>' || lowerPart === '<strong>') {
                isBold = true;
                return null;
            }
            if (lowerPart === '</b>' || lowerPart === '</strong>') {
                isBold = false;
                return null;
            }
            if (lowerPart === '<i>' || lowerPart === '<em>') {
                isItalic = true;
                return null;
            }
            if (lowerPart === '</i>' || lowerPart === '</em>') {
                isItalic = false;
                return null;
            }

            // If it's still a tag (e.g. <div>, <span>, etc.), just ignore it but don't render it
            if (part.startsWith('<') && part.endsWith('>')) {
                return null;
            }

            // Decode basic HTML entities
            const text = part
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&rsquo;/g, "'")
                .replace(/&lsquo;/g, "'")
                .replace(/&ldquo;/g, '"')
                .replace(/&rdquo;/g, '"');

            if (!text) return null;

            return (
                <Text
                    key={index}
                    style={[
                        baseStyle,
                        isBold && styles.bold,
                        isItalic && styles.italic,
                    ]}
                >
                    {text}
                </Text>
            );
        });
    };

    return (
        <View style={containerStyle}>
            <Text style={baseStyle}>{processHtml(html)}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    bold: {
        fontWeight: 'bold',
    },
    italic: {
        fontStyle: 'italic',
    },
});

export default RichText;
