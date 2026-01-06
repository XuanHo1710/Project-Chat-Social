'use client';
import { Box, Card, CardContent, Avatar, Typography } from '@mui/material';
import { Public as PublicIcon, People as PeopleIcon, Lock as LockIcon } from '@mui/icons-material';
import { PostType, PostPrivacy } from '@/types/post';
import { formatPostTime, getAuthorName } from '@/utils/formatPost';
import { HashtagContent } from '@/utils/hashtagParser';
import { useRouter } from 'next/navigation';
import { CLIENT_PATH } from '@/constants/paths';

interface SharedPostPreviewProps {
    sharedPost: PostType;
    onHashtagClick?: (hashtag: string) => void;
    renderPostMedia?: (post: PostType) => React.ReactNode;
}

export default function SharedPostPreview({ sharedPost, onHashtagClick, renderPostMedia }: SharedPostPreviewProps) {
    const router = useRouter();

    const getPrivacyIcon = (privacy: PostPrivacy) => {
        switch (privacy) {
            case 'FRIEND':
                return <PeopleIcon sx={{ fontSize: '12px', color: '#65676b' }} />;
            case 'PRIVATE':
                return <LockIcon sx={{ fontSize: '12px', color: '#65676b' }} />;
            default:
                return <PublicIcon sx={{ fontSize: '12px', color: '#65676b' }} />;
        }
    };

    const handleProfileClick = () => {
        if (sharedPost.userId?.username) {
            router.push(CLIENT_PATH.PROFILE_BY_USERNAME(sharedPost.userId.username));
        }
    };

    const handleHashtagClick = (hashtag: string) => {
        if (onHashtagClick) {
            onHashtagClick(hashtag);
        }
    };

    // Simple media render if no custom renderer provided
    const defaultRenderMedia = (post: PostType) => {
        if (!post.media || post.media.length === 0) return null;

        const media = post.media[0];
        if (media.mediaType === 'IMAGE') {
            return (
                <Box
                    component="img"
                    src={media.url}
                    alt="Shared media"
                    sx={{
                        width: '100%',
                        maxHeight: 300,
                        objectFit: 'cover',
                        borderRadius: 1,
                    }}
                />
            );
        } else if (media.mediaType === 'VIDEO') {
            return (
                <Box
                    component="video"
                    src={media.url}
                    controls
                    sx={{
                        width: '100%',
                        maxHeight: 300,
                        objectFit: 'cover',
                        borderRadius: 1,
                    }}
                />
            );
        }
        return null;
    };

    return (
        <Card
            sx={{
                borderRadius: 2,
                border: '1px solid #e4e6eb',
                bgcolor: '#f5f6f7',
                boxShadow: 'none',
                overflow: 'hidden',
                cursor: 'pointer',
                '&:hover': { bgcolor: '#ebedf0' }
            }}
        >
            <CardContent sx={{ p: 2 }}>
                {/* Shared Post Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                    <Avatar
                        sx={{
                            width: 32,
                            height: 32,
                            mr: 1,
                            cursor: 'pointer',
                            '&:hover': { opacity: 0.8 }
                        }}
                        src={sharedPost.userId?.avatar}
                        onClick={handleProfileClick}
                    />
                    <Box sx={{ flex: 1 }}>
                        <Typography
                            sx={{
                                fontSize: '14px',
                                fontWeight: 600,
                                color: '#050505',
                                cursor: 'pointer',
                                '&:hover': { textDecoration: 'underline' }
                            }}
                            onClick={handleProfileClick}
                        >
                            {getAuthorName(sharedPost)}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography sx={{ fontSize: '12px', color: '#65676b' }}>
                                {formatPostTime(sharedPost.createdAt)}
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#65676b' }}> · </Typography>
                            {getPrivacyIcon(sharedPost.privacy)}
                        </Box>
                    </Box>
                </Box>

                {/* Shared Post Content */}
                {sharedPost.background ? (
                    <Box
                        sx={{
                            background: sharedPost.background,
                            borderRadius: 2,
                            p: 3,
                            minHeight: 150,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mb: sharedPost.media && sharedPost.media.length > 0 ? 1.5 : 0
                        }}
                    >
                        <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'white', textAlign: 'center' }}>
                            <HashtagContent content={sharedPost.content || ''} onHashtagClick={handleHashtagClick} />
                        </Typography>
                    </Box>
                ) : sharedPost.content && (
                    <Typography
                        sx={{
                            mb: sharedPost.media && sharedPost.media.length > 0 ? 1.5 : 0,
                            fontSize: '14px',
                            lineHeight: 1.4,
                            whiteSpace: 'pre-wrap',
                            color: '#050505'
                        }}
                    >
                        <HashtagContent content={sharedPost.content} onHashtagClick={handleHashtagClick} />
                    </Typography>
                )}

                {/* Shared Post Media */}
                {renderPostMedia ? renderPostMedia(sharedPost) : defaultRenderMedia(sharedPost)}
            </CardContent>
        </Card>
    );
}
