export const formatDate = (isoString: Date | string | undefined) => {
    if (isoString === undefined) return "";
    const date = new Date(isoString);
    return date.toLocaleString("vi-VN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });
};
