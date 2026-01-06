export const handleDownload = async (url: string, fileName: string) => {
  const res = await fetch(url);
  const blob = await res.blob();

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName; // <- tên file đúng tiếng Việt
  document.body.appendChild(link);
  link.click();

  link.remove();
  URL.revokeObjectURL(link.href);
};
