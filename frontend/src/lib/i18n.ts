import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Translations
const resources = {
    en: {
        translation: {
            "common": {
                "dashboard": "Dashboard",
                "user_management": "User Management",
                "post_management": "Post Management",
                "settings": "Settings",
                "logout": "Logout",
                "search": "Search...",
                "filter": "Filter",
                "cancel": "Cancel",
                "save": "Save",
                "create": "Create",
                "delete": "Delete",
                "edit": "Edit",
                "status": "Status",
                "actions": "Actions"
            },
            "settings": {
                "title": "Settings",
                "theme_color": "Theme Color",
                "theme_color_admin": "Admin Theme Color",
                "font_size": "Font Size",
                "compact_mode": "Compact Mode",
                "compact_mode_desc": "Reduce spacing between elements",
                "motion": "Motion Effects",
                "motion_desc": "Enable/Disable transition effects",
                "language": "Language",
                "language_vi": "Vietnamese",
                "language_en": "English"
            },
            "dashboard": {
                "total_users": "Total Users",
                "total_posts": "Total Posts",
                "online_users": "Online Users",
                "interactions": "Interactions",
                "traffic_analytics": "Traffic Analytics",
                "emotion_analytics": "Emotion Analytics",
                "new_comments": "New Comments",
                "top_pages": "Top Pages"
            }
        }
    },
    vi: {
        translation: {
            "common": {
                "dashboard": "Tổng quan",
                "user_management": "Quản lý tài khoản",
                "post_management": "Quản lý bài viết",
                "settings": "Cài đặt",
                "logout": "Đăng xuất",
                "search": "Tìm kiếm...",
                "filter": "Bộ lọc",
                "cancel": "Hủy",
                "save": "Lưu",
                "create": "Tạo mới",
                "delete": "Xóa",
                "edit": "Chỉnh sửa",
                "status": "Trạng thái",
                "actions": "Hành động"
            },
            "settings": {
                "title": "Cài đặt",
                "theme_color": "Màu chủ đạo",
                "theme_color_admin": "Màu chủ đạo Admin",
                "font_size": "Cỡ chữ",
                "compact_mode": "Chế độ gọn",
                "compact_mode_desc": "Giảm khoảng cách giữa các phần tử",
                "motion": "Hiệu ứng động",
                "motion_desc": "Bật/tắt hiệu ứng chuyển động",
                "language": "Ngôn ngữ",
                "language_vi": "Tiếng Việt",
                "language_en": "Tiếng Anh"
            },
            "dashboard": {
                "total_users": "Tổng người dùng",
                "total_posts": "Tổng bài viết",
                "online_users": "Đang online",
                "interactions": "Tổng tương tác",
                "traffic_analytics": "Thống kê truy cập",
                "emotion_analytics": "Tương tác cảm xúc",
                "new_comments": "Bình luận mới nhất",
                "top_pages": "Trang xem nhiều nhất"
            }
        }
    }
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: "vi",
        interpolation: {
            escapeValue: false
        }
    });

export default i18n;
