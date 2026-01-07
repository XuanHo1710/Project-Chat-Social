import { accountService } from '@/services/account.service';
import { CommentMedia } from '@/types/comment';
import { MediaItem } from '@/types/post';
import Link from 'next/link';
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


export const commentMediaToMediaItems = (media: CommentMedia[]): MediaItem[] => {
    return media.map(m => ({
        mediaType: m.mediaType,
        url: m.url,
        publicId: m.publicId || '',
        width: m.width,
        height: m.height,
    }));
}

export const renderContentWithMentions = (content: string) => {
    if (!content) return null;

    // Combined regex for mentions and hashtags
    const mentionRegex = /@\[([^\]:]+):([^\]]+)\]/gi;
    const hashtagRegex = /#([\w\u00C0-\u024F\u1E00-\u1EFF]+)/gi;

    // First, collect all matches with their positions
    const matches: Array<{
        index: number;
        length: number;
        type: 'mention' | 'hashtag';
        content: React.ReactNode;
    }> = [];

    // Find all mentions
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
        const userName = match[1];
        const displayName = match[2];
        matches.push({
            index: match.index,
            length: match[0].length,
            type: 'mention',
            content: (
                <Link
                    key={`mention-${match.index}`}
                    href={`/profile/${userName}`}
                    style={{
                        color: '#1877f2',
                        textDecoration: 'none',
                        fontWeight: 600,
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    @{displayName}
                </Link>
            ),
        });
    }

    // Find all hashtags
    while ((match = hashtagRegex.exec(content)) !== null) {
        const hashtag = match[1];
        const fullMatch = match[0];
        matches.push({
            index: match.index,
            length: fullMatch.length,
            type: 'hashtag',
            content: (
                <span
                    key={`hashtag-${match.index}`}
                    style={{
                        color: '#1877f2',
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Navigate to hashtag search
                        console.log('Clicked hashtag:', hashtag);
                    }}
                >
                    {fullMatch}
                </span>
            ),
        });
    }

    // Sort matches by index
    matches.sort((a, b) => a.index - b.index);

    // Build result array
    const parts: (string | React.ReactNode)[] = [];
    let lastIndex = 0;

    for (const m of matches) {
        // Skip if this match overlaps with previous (shouldn't happen normally)
        if (m.index < lastIndex) continue;

        // Add text before this match
        if (m.index > lastIndex) {
            parts.push(content.slice(lastIndex, m.index));
        }

        parts.push(m.content);
        lastIndex = m.index + m.length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
        parts.push(content.slice(lastIndex));
    }

    return parts.length > 0 ? parts : content;
}
