import {
    Box, Typography, Divider, MenuItem, ListItemIcon, Switch, useTheme
} from '@mui/material';
import {
    Close as CloseIcon,
    Favorite as FavoriteIcon,
    RemoveCircleOutline as RemoveIcon,
    BookmarkBorder as BookmarkBorderIcon,
    NotificationsActive as NotificationIcon,
    Info as InfoIcon,
    Report as ReportIcon,
    Block as BlockIcon,
    VisibilityOff as HideIcon,
    Edit as EditIcon,
    Comment as CommentIcon,
    Share as ShareIcon,
    ThumbUp as ThumbUpIcon,
} from '@mui/icons-material';
import { PostType } from '@/types/post';
import { useTranslation } from 'react-i18next';

interface PostOptionContentMenuProps {
    menuPost: PostType | null;
    user: { id: string } | null;
    handleEditPost: () => void;
    handleDeletePost: () => void;
    isDeleting: boolean;
    onToggleComments?: (allow: boolean) => void;
    onToggleShares?: (allow: boolean) => void;
    onToggleReactions?: (allow: boolean) => void;
    onHidePost?: () => void;
    onNotInterested?: () => void;
}

export default function PostOptionContentMenu({
    menuPost,
    user,
    handleEditPost,
    handleDeletePost,
    isDeleting,
    onToggleComments,
    onToggleShares,
    onToggleReactions,
    onHidePost,
    onNotInterested,
}: PostOptionContentMenuProps) {
    const isOwner = menuPost && user?.id === menuPost.userId?._id;
    const { t } = useTranslation();

    return (
        <>
            {/* Owner actions - Edit & Delete */}
            {isOwner ? (
                <>
                    <MenuItem onClick={handleEditPost} sx={{ py: 1.5 }}>
                        <ListItemIcon><EditIcon /></ListItemIcon>
                        <Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>{t('post.edit_post')}</Typography></Box>
                    </MenuItem>
                    <MenuItem onClick={handleDeletePost} disabled={isDeleting} sx={{ py: 1.5 }}>
                        <ListItemIcon><CloseIcon sx={{ color: '#f44336' }} /></ListItemIcon>
                        <Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: '#f44336' }}>{isDeleting ? t('common.deleting') : t('post.delete_post')}</Typography></Box>
                    </MenuItem>
                    <Divider />

                    {/* Toggle Features */}
                    <MenuItem
                        onClick={() => onToggleComments?.(!menuPost.allowComments)}
                        sx={{ py: 1.5, display: 'flex', justifyContent: 'space-between' }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <ListItemIcon><CommentIcon /></ListItemIcon>
                            <Box>
                                <Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>
                                    {t('post.allow_comments')}
                                </Typography>
                                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                                    {menuPost.allowComments !== false ? t('common.on') : t('common.off')}
                                </Typography>
                            </Box>
                        </Box>
                        <Switch
                            checked={menuPost.allowComments !== false}
                            size="small"
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onToggleComments?.(e.target.checked)}
                        />
                    </MenuItem>

                    <MenuItem
                        onClick={() => onToggleShares?.(!menuPost.allowShares)}
                        sx={{ py: 1.5, display: 'flex', justifyContent: 'space-between' }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <ListItemIcon><ShareIcon /></ListItemIcon>
                            <Box>
                                <Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>
                                    {t('post.allow_shares')}
                                </Typography>
                                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                                    {menuPost.allowShares !== false ? t('common.on') : t('common.off')}
                                </Typography>
                            </Box>
                        </Box>
                        <Switch
                            checked={menuPost.allowShares !== false}
                            size="small"
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onToggleShares?.(e.target.checked)}
                        />
                    </MenuItem>

                    <MenuItem
                        onClick={() => onToggleReactions?.(!menuPost.allowReactions)}
                        sx={{ py: 1.5, display: 'flex', justifyContent: 'space-between' }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <ListItemIcon><ThumbUpIcon /></ListItemIcon>
                            <Box>
                                <Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>
                                    {t('post.allow_reactions')}
                                </Typography>
                                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                                    {menuPost.allowReactions !== false ? t('common.on') : t('common.off')}
                                </Typography>
                            </Box>
                        </Box>
                        <Switch
                            checked={menuPost.allowReactions !== false}
                            size="small"
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onToggleReactions?.(e.target.checked)}
                        />
                    </MenuItem>
                    <Divider />
                </>
            ) : null}
            <MenuItem sx={{ py: 1.5 }}><ListItemIcon><FavoriteIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>{t('post.interested')}</Typography><Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('post.interested_desc')}</Typography></Box></MenuItem>
            <MenuItem onClick={onNotInterested} sx={{ py: 1.5 }}><ListItemIcon><RemoveIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>{t('post.not_interested')}</Typography><Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('post.not_interested_desc')}</Typography></Box></MenuItem>
            <Divider />
            <MenuItem sx={{ py: 1.5 }}><ListItemIcon><BookmarkBorderIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>{t('post.save_post')}</Typography><Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('post.save_post_desc')}</Typography></Box></MenuItem>
            <Divider />
            <MenuItem sx={{ py: 1.5 }}><ListItemIcon><NotificationIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>{t('post.turn_on_notifications')}</Typography></Box></MenuItem>
            <MenuItem sx={{ py: 1.5 }}><ListItemIcon><InfoIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>{t('post.why_seeing_this')}</Typography></Box></MenuItem>
            {/* Non-owner actions */}
            {menuPost && user?.id !== menuPost.userId?._id ? (
                <>
                    <Divider />
                    <MenuItem sx={{ py: 1.5 }}><ListItemIcon><ReportIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>{t('post.report_post')}</Typography></Box></MenuItem>
                    <MenuItem onClick={onHidePost} sx={{ py: 1.5 }}><ListItemIcon><HideIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>{t('post.hide_post')}</Typography><Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('post.hide_post_desc')}</Typography></Box></MenuItem>
                    <MenuItem sx={{ py: 1.5 }}><ListItemIcon><BlockIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>{t('post.snooze_30_days')}</Typography></Box></MenuItem>
                </>
            ) : null}
        </>
    );
}