import { UPLOAD } from "@/config/constants";

/** Shared browser validation; API routes still validate every request. */
export function validateDocumentFile(
  file: Pick<File, "name" | "size">,
): string | null {
  if (
    !UPLOAD.ACCEPTED_EXTENSIONS.some((extension) =>
      file.name.toLowerCase().endsWith(extension),
    )
  ) {
    return (
      "Unsupported file type. Use " +
      UPLOAD.ACCEPTED_EXTENSIONS.join(", ") +
      "."
    );
  }
  if (file.size === 0)
    return "This file is empty. Choose a document with content.";
  if (file.size > UPLOAD.MAX_SIZE_BYTES) {
    return (
      "File is too large. The limit is " +
      UPLOAD.MAX_SIZE_BYTES / (1024 * 1024) +
      " MB."
    );
  }
  return null;
}

/** Session-local repeated-selection identity; this is not a content hash. */
export function documentFileKey(
  file: Pick<File, "name" | "size" | "lastModified">,
): string {
  return JSON.stringify([file.name, file.size, file.lastModified]);
}
