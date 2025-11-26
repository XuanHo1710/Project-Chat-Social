export const formatDate = (isoString: Date | string | undefined) => {
    if (isoString === undefined) return "";
    const date = new Date(isoString);
    return date.toLocaleString("vi-VN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });
};


export const formatDateTime = (isoString: Date | string) => {
    const date = new Date(isoString);
    return date.toLocaleString("vi-VN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
};

export const formatTime = (isoString: Date | string) => {
    const date = new Date(isoString);
    return date.toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
    });
};