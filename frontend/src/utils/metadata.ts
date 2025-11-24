// Metadata utility for dynamic SEO
export const generateProductMetadata = (product: {
    name: string;
    newPrice: number;
    oldPrice: number;
    discount: number;
    description?: string;
    ratingAvg?: number;
    totalRatings?: number;
    soldCount?: number;
    images: string[];
    category?: { name: string };
}) => {
    return {
        title: `${product.name} - Giá ${product.newPrice.toLocaleString()}đ | PC Store`,
        description: `Mua ${product.name} chính hãng giá ${product.newPrice.toLocaleString()}đ (Giảm ${product.discount.toFixed(0)}% từ ${product.oldPrice.toLocaleString()}đ). ${product.description || 'Bảo hành chính hãng, giao hàng nhanh, trả góp 0%.'} ⭐ Đánh giá ${product.ratingAvg?.toFixed(1)}/5 (${product.totalRatings} đánh giá). Đã bán ${product.soldCount}+ sản phẩm.`,
        keywords: `${product.name}, mua ${product.name}, ${product.name} giá rẻ, ${product.name} chính hãng, ${product.category?.name || 'pc gaming'}, linh kiện máy tính`,
        ogTitle: `${product.name} - Sale ${product.discount.toFixed(0)}% còn ${product.newPrice.toLocaleString()}đ`,
        ogDescription: `⭐ ${product.ratingAvg?.toFixed(1)}/5 (${product.totalRatings} đánh giá) | Đã bán ${product.soldCount}+ | ${product.description || 'Bảo hành chính hãng, giao hàng nhanh'}`,
        ogImage: product.images[0] || '/logo.jpg',
    };
};

export const generateCategoryMetadata = (category: {
    name: string;
    slug: string;
}, totalProducts: number = 0) => {
    return {
        title: `${category.name} - PC Store | Mua ${category.name} chính hãng giá tốt`,
        description: `Mua ${category.name} chính hãng với giá tốt nhất tại PC Store. Đa dạng sản phẩm, bảo hành uy tín, giao hàng nhanh, hỗ trợ trả góp 0%. Tổng ${totalProducts} sản phẩm.`,
        keywords: `${category.name}, mua ${category.name}, ${category.name} giá rẻ, ${category.name} chính hãng, ${category.name} uy tín`,
        ogTitle: `${category.name} - Hơn ${totalProducts} sản phẩm chính hãng`,
        ogDescription: `Khám phá bộ sưu tập ${category.name} đa dạng tại PC Store. Giá tốt, chất lượng cao, bảo hành chính hãng.`,
    };
};

export const homeMetadata = {
    title: "PC Store - Mua sắm PC Gaming, Laptop, Linh kiện chính hãng",
    description: "Chuyên cung cấp PC Gaming, Laptop Gaming, Linh kiện máy tính chính hãng với giá tốt nhất. Bảo hành uy tín, giao hàng toàn quốc, trả góp 0%.",
    keywords: "pc gaming, laptop gaming, laptop văn phòng, linh kiện máy tính, màn hình gaming, bàn phím cơ, chuột gaming, tai nghe gaming, pc build, pc giá rẻ, laptop giá rẻ",
    ogTitle: "PC Store - Siêu thị PC & Laptop Gaming chính hãng",
    ogDescription: "Hệ thống bán lẻ PC, Laptop, linh kiện chính hãng uy tín với giá tốt nhất. Bảo hành toàn diện, giao hàng nhanh, hỗ trợ trả góp 0%.",
    ogImage: "/logo.jpg",
};

export const cartMetadata = (itemCount: number = 0) => ({
    title: `Giỏ hàng của bạn - PC Store`,
    description: `Xem lại giỏ hàng và hoàn tất đơn hàng của bạn tại PC Store. Miễn phí vận chuyển cho đơn hàng trên 2 triệu. Hỗ trợ trả góp 0%.`,
    keywords: "giỏ hàng, thanh toán, mua hàng, đơn hàng, pc store",
    ogTitle: `Giỏ hàng`,
    ogDescription: "Hoàn tất đơn hàng ngay để nhận ưu đãi miễn phí vận chuyển và trả góp 0%",
});

export const paymentMetadata = {
    title: "Thanh toán đơn hàng - PC Store",
    description: "Hoàn tất thanh toán đơn hàng tại PC Store. Hỗ trợ nhiều phương thức thanh toán: COD, chuyển khoản, VNPAY. Bảo mật tuyệt đối.",
    keywords: "thanh toán, payment, vnpay, cod, chuyển khoản, đơn hàng",
    ogTitle: "Thanh toán đơn hàng - An toàn & Nhanh chóng",
    ogDescription: "Hỗ trợ đa dạng phương thức thanh toán, bảo mật thông tin tuyệt đối",
};

export const wishlistMetadata = (itemCount: number = 0) => ({
    title: `Danh sách yêu thích (${itemCount} sản phẩm) - PC Store`,
    description: "Quản lý danh sách sản phẩm yêu thích của bạn tại PC Store. Dễ dàng theo dõi và mua sắm các sản phẩm bạn quan tâm.",
    keywords: "danh sách yêu thích, wishlist, sản phẩm yêu thích, theo dõi sản phẩm",
    ogTitle: "Danh sách yêu thích của tôi - PC Store",
    ogDescription: "Quản lý và theo dõi các sản phẩm yêu thích của bạn",
});
