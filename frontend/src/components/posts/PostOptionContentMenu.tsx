import {
    Box, Typography, Divider, MenuItem, ListItemIcon
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
} from '@mui/icons-material';
import { PostType } from '@/types/post';

export default function PostOptionContentMenu({ menuPost, user, handleEditPost, handleDeletePost, isDeleting }: { menuPost: PostType | null, user: { id: string } | null, handleEditPost: () => void, handleDeletePost: () => void, isDeleting: boolean }) {
    return (
        <>
            {/* Owner actions - Edit & Delete */}
            {menuPost && user?.id === menuPost.userId?._id ? (
                <>
                    <MenuItem onClick={handleEditPost} sx={{ py: 1.5 }}>
                        <ListItemIcon><EditIcon /></ListItemIcon>
                        <Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>Chỉnh sửa bài viết</Typography></Box>
                    </MenuItem>
                    <MenuItem onClick={handleDeletePost} disabled={isDeleting} sx={{ py: 1.5 }}>
                        <ListItemIcon><CloseIcon sx={{ color: '#f44336' }} /></ListItemIcon>
                        <Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: '#f44336' }}>{isDeleting ? 'Đang xóa...' : 'Xóa bài viết'}</Typography></Box>
                    </MenuItem>
                    <Divider />
                </>
            ) : null}
            <MenuItem sx={{ py: 1.5 }}><ListItemIcon><FavoriteIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>Quan tâm</Typography><Typography sx={{ fontSize: 12, color: '#65676b' }}>Bạn sẽ nhìn thấy nhiều bài viết tương tự hơn.</Typography></Box></MenuItem>
            <MenuItem sx={{ py: 1.5 }}><ListItemIcon><RemoveIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>Không quan tâm</Typography><Typography sx={{ fontSize: 12, color: '#65676b' }}>Bạn sẽ nhìn thấy ít bài viết tương tự hơn.</Typography></Box></MenuItem>
            <Divider />
            <MenuItem sx={{ py: 1.5 }}><ListItemIcon><BookmarkBorderIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>Lưu bài viết</Typography><Typography sx={{ fontSize: 12, color: '#65676b' }}>Thêm vào danh sách mục đã lưu.</Typography></Box></MenuItem>
            <Divider />
            <MenuItem sx={{ py: 1.5 }}><ListItemIcon><NotificationIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>Bật thông báo về bài viết này</Typography></Box></MenuItem>
            <MenuItem sx={{ py: 1.5 }}><ListItemIcon><InfoIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>Tại sao tôi nhìn thấy bài viết này?</Typography></Box></MenuItem>
            {/* Non-owner actions */}
            {menuPost && user?.id !== menuPost.userId?._id ? (
                <>
                    <Divider />
                    <MenuItem sx={{ py: 1.5 }}><ListItemIcon><ReportIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>Báo cáo bài viết</Typography></Box></MenuItem>
                    <MenuItem sx={{ py: 1.5 }}><ListItemIcon><HideIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>Ẩn bài viết</Typography><Typography sx={{ fontSize: 12, color: '#65676b' }}>Ẩn bớt các bài viết tương tự.</Typography></Box></MenuItem>
                    <MenuItem sx={{ py: 1.5 }}><ListItemIcon><BlockIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>Tạm ẩn trong 30 ngày</Typography></Box></MenuItem>
                </>
            ) : null}
        </>
    );
} 