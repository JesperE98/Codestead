// Port of Vfs/FsError.cs – virtual file system: an error with an errno-like code (ENOENT, EACCES ...).

export type FsErrorCode = "ENOENT" | "EACCES" | "ENOTDIR" | "EISDIR" | "EEXIST" | "ENOTEMPTY" | "EPERM" | "EINVAL" | "ELOOP";

const messages: Record<FsErrorCode, string> = {
  ENOENT: "No such file or directory",
  EACCES: "Permission denied",
  ENOTDIR: "Not a directory",
  EISDIR: "Is a directory",
  EEXIST: "File exists",
  ENOTEMPTY: "Directory not empty",
  EPERM: "Operation not permitted",
  EINVAL: "Invalid argument",
  ELOOP: "Too many levels of symbolic links",
};

export class FsError extends Error {
  /** ENOENT, EACCES, ENOTDIR, EISDIR, EEXIST, ENOTEMPTY, EPERM, EINVAL or ELOOP. */
  readonly code: FsErrorCode;

  constructor(code: FsErrorCode) {
    super(messages[code]);
    this.code = code;
    this.name = "FsError";
  }
}
