/** Call directly from a click handler so the picker retains user activation. */
export async function savePng({ url, blob, filename = `screenshot-${Date.now()}.png` }) {
  let handle;
  if (typeof window.showSaveFilePicker === 'function') {
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'PNG image', accept: { 'image/png': ['.png'] } }],
        excludeAcceptAllOption: true,
      });
    } catch (error) {
      if (error.name === 'AbortError') return 'cancelled';
      throw error;
    }
  }

  if (!blob) {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Error('Не удалось скачать изображение с сервера.');
    blob = await response.blob();
  }

  if (handle) {
    const writable = await handle.createWritable();
    try {
      await writable.write(blob);
      await writable.close();
    } catch (error) {
      await writable.abort().catch(() => {});
      throw error;
    }
    return 'saved';
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // Let the browser start reading the blob before releasing it.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  return 'downloaded';
}
