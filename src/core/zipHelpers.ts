import JSZip from "jszip";

const TEXT_LIKE = /\.(txt|md|json|csv|log|js|ts|css|html|xml|yml|yaml)$/i;

/** Recursively adds a real file or folder into a JSZip archive at relPath, reading real bytes via the fs IPC bridge. */
export async function addPathToZip(zip: JSZip, realPath: string, relPath: string, isDirectory: boolean) {
  if (isDirectory) {
    const result = await window.anchoran!.fsListDir(realPath);
    if ("error" in result) return;
    for (const entry of result.entries) {
      await addPathToZip(zip, entry.path, `${relPath}/${entry.name}`, entry.isDirectory);
    }
    return;
  }
  const name = relPath;
  if (TEXT_LIKE.test(name)) {
    const text = await window.anchoran!.fsReadTextFile(realPath);
    zip.file(name, "content" in text ? text.content : "");
  } else {
    const img = await window.anchoran!.fsReadImageFile(realPath);
    if ("dataUrl" in img) {
      zip.file(name, img.dataUrl.split(",")[1] ?? "", { base64: true });
    } else {
      const bin = await window.anchoran!.fsReadBinary(realPath);
      if ("base64" in bin) zip.file(name, bin.base64, { base64: true });
      else zip.file(name, ""); // Unreadable — recorded as an empty placeholder rather than dropped.
    }
  }
}

/** Extracts every entry of a loaded JSZip into a new folder named rootFolderName under destParent. Returns the new root folder's real path, or an error. */
export async function extractZipTo(
  zip: JSZip,
  destParent: string,
  rootFolderName: string
): Promise<{ path: string } | { error: string }> {
  const rootDirResult = await window.anchoran!.fsCreateFolder(destParent, rootFolderName);
  if ("error" in rootDirResult) return rootDirResult;

  const dirByPath = new Map<string, string>([["", rootDirResult.path]]);
  const entries = Object.values(zip.files).sort((a, b) => a.name.length - b.name.length);
  for (const entry of entries) {
    const parts = entry.name.replace(/\/$/, "").split("/");
    const name = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join("/");
    const parentDir = dirByPath.get(parentPath) ?? rootDirResult.path;
    if (entry.dir) {
      const created = await window.anchoran!.fsCreateFolder(parentDir, name);
      if (!("error" in created)) dirByPath.set(parts.join("/"), created.path);
    } else if (TEXT_LIKE.test(name)) {
      const text = await entry.async("text");
      await window.anchoran!.fsCreateFile(parentDir, name, text);
    } else {
      const base64 = await entry.async("base64");
      await window.anchoran!.fsWriteDataUrl(parentDir, name, `data:application/octet-stream;base64,${base64}`);
    }
  }
  return { path: rootDirResult.path };
}
