import React from 'react';

/**
 * Parse content and highlight hashtags with blue color
 * @param content - The text content to parse
 * @param onClick - Optional callback when hashtag is clicked
 * @returns Array of React nodes with highlighted hashtags
 */
export function parseHashtags(
    content: string,
    onClick?: (hashtag: string) => void
): React.ReactNode[] {
    if (!content) return [];

    // Regex to match hashtags with Unicode support
    const hashtagRegex = /#([\w\u00C0-\u024F\u1E00-\u1EFF]+)/g;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = hashtagRegex.exec(content)) !== null) {
        // Add text before the hashtag
        if (match.index > lastIndex) {
            parts.push(content.slice(lastIndex, match.index));
        }

        // Add the hashtag with styling
        const fullHashtag = match[0]; // Including #
        const tagText = match[1]; // Without #

        parts.push(
            <span
                key={`${match.index}-${tagText}`}
                style={{
                    color: '#1877f2',
                    fontWeight: 600,
                    cursor: onClick ? 'pointer' : 'inherit',
                }}
                onClick={onClick ? (e) => {
                    e.stopPropagation();
                    onClick(tagText);
                } : undefined}
                onMouseEnter={onClick ? (e) => {
                    (e.target as HTMLElement).style.textDecoration = 'underline';
                } : undefined}
                onMouseLeave={onClick ? (e) => {
                    (e.target as HTMLElement).style.textDecoration = 'none';
                } : undefined}
            >
                {fullHashtag}
            </span>
        );

        lastIndex = match.index + fullHashtag.length;
    }

    // Add remaining text after last hashtag
    if (lastIndex < content.length) {
        parts.push(content.slice(lastIndex));
    }

    return parts.length > 0 ? parts : [content];
}

/**
 * Component wrapper for content with hashtags
 */
interface HashtagContentProps {
    content: string;
    onHashtagClick?: (hashtag: string) => void;
    style?: React.CSSProperties;
    className?: string;
}

export const HashtagContent: React.FC<HashtagContentProps> = ({
    content,
    onHashtagClick,
    style,
    className,
}) => {
    return (
        <span style={style} className={className}>
            {parseHashtags(content, onHashtagClick)}
        </span>
    );
};

export default HashtagContent;
