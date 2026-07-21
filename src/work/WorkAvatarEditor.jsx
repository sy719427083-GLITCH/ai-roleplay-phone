import { useEffect, useState } from "react";

export async function resizeOfficeAvatar(file) {
  if (!file) throw new Error("missing file");
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 320;
  const context = canvas.getContext("2d");
  const scale = Math.max(320 / bitmap.width, 320 / bitmap.height);
  context.drawImage(bitmap, (320 - bitmap.width * scale) / 2, (320 - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
  bitmap.close();
  return canvas.toDataURL("image/webp", 0.82);
}

const verifyImageUrl = (url) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(url);
  image.onerror = reject;
  image.src = url;
});

export function WorkAvatarEditor({ override, onChange, onClear, onError }) {
  const [url, setUrl] = useState(override?.type === "url" ? override.value : "");

  useEffect(() => setUrl(override?.type === "url" ? override.value : ""), [override]);

  const applyUrl = async () => {
    const nextUrl = url.trim();
    if (!/^https?:\/\//i.test(nextUrl)) return onError("请输入有效的网页图片 URL");
    try {
      await verifyImageUrl(nextUrl);
      onChange({ type: "url", value: nextUrl });
    } catch {
      onError("图片 URL 加载失败");
    }
  };

  return (
    <div className="work-avatar-editor">
      <label className="work-upload-button">
        上传图片
        <input
          type="file"
          accept="image/*"
          onChange={async (event) => {
            try {
              const value = await resizeOfficeAvatar(event.target.files?.[0]);
              onChange({ type: "upload", value });
            } catch {
              onError("头像上传失败");
            }
            event.target.value = "";
          }}
        />
      </label>
      <div className="work-url-row">
        <label>图片 URL<input value={url} placeholder="https://..." onChange={(event) => setUrl(event.target.value)} /></label>
        <button type="button" onClick={applyUrl}>应用</button>
      </div>
      <button className="work-avatar-restore" type="button" onClick={onClear}>恢复原头像</button>
    </div>
  );
}
