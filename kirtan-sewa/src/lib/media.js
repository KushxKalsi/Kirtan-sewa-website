/**
 * Uploads one photo, video or audio file: the server says where to send it (Cloudflare R2 directly, or the site's own
 * storage), then the file goes there with progress. Returns { id, kind } to name in the post.
 */
export async function uploadMedia(client, file, onProgress) {
  const { id, kind, url, direct } = await client.startUpload(file.type, file.size);
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status < 300) return resolve();
      let message = 'Upload failed. Please try again.';
      try {
        message = JSON.parse(xhr.responseText).error || message;
      } catch {
        /* R2 answers in XML */
      }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error(direct ? 'Upload failed — the storage bucket may not allow uploads from this site yet (CORS).' : 'Upload failed. Check your connection.'));
    xhr.send(file);
  });
  onProgress?.(1);
  return { id, kind };
}

/** A phone photo made smaller (longest side `max`) as a JPEG file; small files are kept as they are. */
export function shrinkPhoto(file, max = 2000, quality = 0.86) {
  if (!file.type.startsWith('image/') || file.size < 500 * 1024) return Promise.resolve(file);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      canvas.toBlob((blob) => resolve(blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : file), 'image/jpeg', quality);
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

/** Length of a video or audio file in seconds (0 if the browser can't tell). */
export function mediaDuration(file) {
  return new Promise((resolve) => {
    const el = document.createElement(file.type.startsWith('audio/') ? 'audio' : 'video');
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(el.src);
      resolve(Number.isFinite(el.duration) ? el.duration : 0);
    };
    el.onerror = () => resolve(0);
    el.src = URL.createObjectURL(file);
  });
}

// iPhones record .mov as video/quicktime and m4a sometimes without a type; fill in what the server accepts.
export function withType(file) {
  if (file.type) return file;
  const ext = file.name.split('.').pop()?.toLowerCase();
  const type = { mov: 'video/quicktime', mp4: 'video/mp4', m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', webm: 'video/webm' }[ext];
  return type ? new File([file], file.name, { type }) : file;
}
