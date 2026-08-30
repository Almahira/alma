// File: packages/core_unv/src/io/imageCompressor.ts

export async function compressImageAuto(file: File, maxMb = 5): Promise<File> {
  const maxSize = maxMb * 1024 * 1024;
  if (file.size <= maxSize) return file;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        // Hitung rasio kompresi dimensi
        const scaleSize = maxSize / file.size;
        canvas.width = img.width * Math.sqrt(scaleSize);
        canvas.height = img.height * Math.sqrt(scaleSize);

        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas tidak didukung"));

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Gagal mengkompresi gambar"));
            const newFile = new File([blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(newFile);
          },
          "image/jpeg",
          0.8, // Kualitas 80%
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}
