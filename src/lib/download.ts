export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Revoke after the browser has had time to start the download (memory hygiene).
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
