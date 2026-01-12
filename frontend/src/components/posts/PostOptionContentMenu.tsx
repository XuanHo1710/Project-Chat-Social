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

interface PostOptionContentMenuProps {
    menuPost: PostType | null;
    user: { id: string } | null;
    handleEditPost: () => void;
    handleDeletePost: () => void;
    isDeleting: boolean;
    onToggleComments?: (allow: boolean) => void;
    onToggleShares?: (allow: boolean) => void;
    onToggleReactions?: (allow: boolean) => void;
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
}: PostOptionContentMenuProps) {
    const isOwner = menuPost && user?.id === menuPost.userId?._id;

    return (
        <>
            {/* Owner actions - Edit & Delete */}
            {isOwner ? (
                <>
                    <MenuItem onClick={handleEditPost} sx={{ py: 1.5 }}>
                        <ListItemIcon><EditIcon /></ListItemIcon>
                        <Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>Chỉnh sửa bài viết</Typography></Box>
                    </MenuItem>
                    <MenuItem onClick={handleDeletePost} disabled={isDeleting} sx={{ py: 1.5 }}>
                        <ListItemIcon><CloseIcon sx={{ color: '#f44336' }} /></ListItemIcon>
                        <Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: '#f44336' }}>{isDeleting ? 'Đang xóa...' : 'Xóa bài viết'}</Typography></Box>
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
                                    Cho phép bình luận
                                </Typography>
                                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                                    {menuPost.allowComments !== false ? 'Đang bật' : 'Đang tắt'}
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
                                    Cho phép chia sẻ
                                </Typography>
                                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                                    {menuPost.allowShares !== false ? 'Đang bật' : 'Đang tắt'}
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
                                    Cho phép tương tác
                                </Typography>
                                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                                    {menuPost.allowReactions !== false ? 'Đang bật' : 'Đang tắt'}
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
            <MenuItem sx={{ py: 1.5 }}><ListItemIcon><FavoriteIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>Quan tâm</Typography><Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Bạn sẽ nhìn thấy nhiều bài viết tương tự hơn.</Typography></Box></MenuItem>
            <MenuItem sx={{ py: 1.5 }}><ListItemIcon><RemoveIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>Không quan tâm</Typography><Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Bạn sẽ nhìn thấy ít bài viết tương tự hơn.</Typography></Box></MenuItem>
            <Divider />
            <MenuItem sx={{ py: 1.5 }}><ListItemIcon><BookmarkBorderIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>Lưu bài viết</Typography><Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Thêm vào danh sách mục đã lưu.</Typography></Box></MenuItem>
            <Divider />
            <MenuItem sx={{ py: 1.5 }}><ListItemIcon><NotificationIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>Bật thông báo về bài viết này</Typography></Box></MenuItem>
            <MenuItem sx={{ py: 1.5 }}><ListItemIcon><InfoIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>Tại sao tôi nhìn thấy bài viết này?</Typography></Box></MenuItem>
            {/* Non-owner actions */}
            {menuPost && user?.id !== menuPost.userId?._id ? (
                <>
                    <Divider />
                    <MenuItem sx={{ py: 1.5 }}><ListItemIcon><ReportIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>Báo cáo bài viết</Typography></Box></MenuItem>
                    <MenuItem sx={{ py: 1.5 }}><ListItemIcon><HideIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>Ẩn bài viết</Typography><Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Ẩn bớt các bài viết tương tự.</Typography></Box></MenuItem>
                    <MenuItem sx={{ py: 1.5 }}><ListItemIcon><BlockIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>Tạm ẩn trong 30 ngày</Typography></Box></MenuItem>
                </>
            ) : null}
        </>
    );
}