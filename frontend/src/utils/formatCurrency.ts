import i18n from "@/lib/i18n";

export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat(i18n.language || "vi-VN", {
        style: 'currency',
        currency: 'VND',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

export const formatPrice = (price: number): string => {
    return price.toLocaleString(i18n.language || "vi-VN") + ' ₫';
};
