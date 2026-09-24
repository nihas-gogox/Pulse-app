export async function compressImage(
  fileOrBlob: Blob,
  maxWidth = 1200,
  quality = 0.6,
): Promise<Blob> {
  if (typeof document === 'undefined') return fileOrBlob; // Skip on native
  if (!fileOrBlob.type.startsWith('image/')) {
    return fileOrBlob;
  }
  
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(fileOrBlob);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height *= maxWidth / width));
            width = maxWidth;
          } else {
            width = Math.round((width *= maxWidth / height));
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(fileOrBlob);
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else resolve(fileOrBlob);
          },
          'image/jpeg',
          quality,
        );
      };
      img.onerror = () => resolve(fileOrBlob);
    };
    reader.onerror = () => resolve(fileOrBlob);
  });
}
