import fs from "node:fs";
import path from "node:path";

export function resolveApprovedSourcePath(sourceRoot, relativePath) {
  const rootPath = path.resolve(sourceRoot);
  const rootStat = fs.lstatSync(rootPath);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error("Approved public source root must be a regular directory, not a symbolic link.");
  }

  const requestedPath = path.resolve(rootPath, relativePath);
  const relative = path.relative(rootPath, requestedPath);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Approved public path escapes the source root: ${relativePath}`);
  }

  const parts = relative.split(path.sep);
  let currentPath = rootPath;
  for (const [index, part] of parts.entries()) {
    currentPath = path.join(currentPath, part);
    let stat;
    try {
      stat = fs.lstatSync(currentPath);
    } catch (error) {
      if (error?.code === "ENOENT") throw new Error(`Approved public file is missing: ${relativePath}`);
      throw error;
    }
    if (stat.isSymbolicLink()) {
      throw new Error(`Approved public path must not include symbolic links: ${relativePath}`);
    }
    const finalPart = index === parts.length - 1;
    if (!finalPart && !stat.isDirectory()) {
      throw new Error(`Approved public path has a non-directory ancestor: ${relativePath}`);
    }
    if (finalPart && !stat.isFile()) {
      throw new Error(`Approved public path is not a regular file: ${relativePath}`);
    }
    if (finalPart && stat.nlink !== 1) {
      throw new Error(`Approved public path must not have multiple hard links: ${relativePath}`);
    }
  }

  const canonicalRoot = fs.realpathSync(rootPath);
  const canonicalSource = fs.realpathSync(requestedPath);
  const canonicalRelative = path.relative(canonicalRoot, canonicalSource);
  if (
    !canonicalRelative
    || canonicalRelative === ".."
    || canonicalRelative.startsWith(`..${path.sep}`)
    || path.isAbsolute(canonicalRelative)
  ) {
    throw new Error(`Approved public path resolves outside the source root: ${relativePath}`);
  }
  return canonicalSource;
}

export function openApprovedSourceFile(sourceRoot, relativePath) {
  const sourcePath = resolveApprovedSourcePath(sourceRoot, relativePath);
  const noFollow = fs.constants.O_NOFOLLOW ?? 0;
  let fileDescriptor;
  try {
    fileDescriptor = fs.openSync(sourcePath, fs.constants.O_RDONLY | noFollow);
    const openedStat = fs.fstatSync(fileDescriptor, { bigint: true });
    if (!openedStat.isFile()) throw new Error(`Approved public path is not a regular file: ${relativePath}`);
    if (openedStat.nlink !== 1n) throw new Error(`Approved public path must not have multiple hard links: ${relativePath}`);

    const confirmedPath = resolveApprovedSourcePath(sourceRoot, relativePath);
    const confirmedStat = fs.statSync(confirmedPath, { bigint: true });
    if (openedStat.dev !== confirmedStat.dev || openedStat.ino !== confirmedStat.ino) {
      throw new Error(`Approved public path changed during the build: ${relativePath}`);
    }
    return { fileDescriptor, sourcePath: confirmedPath };
  } catch (error) {
    if (fileDescriptor !== undefined) fs.closeSync(fileDescriptor);
    if (error?.code === "ELOOP") {
      throw new Error(`Approved public path must not include symbolic links: ${relativePath}`);
    }
    throw error;
  }
}

export function copyApprovedSourceFile(sourceRoot, relativePath, outputPath) {
  const { fileDescriptor } = openApprovedSourceFile(sourceRoot, relativePath);
  let outputDescriptor;
  try {
    outputDescriptor = fs.openSync(outputPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o666);
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let bytesRead;
    while ((bytesRead = fs.readSync(fileDescriptor, buffer, 0, buffer.length, null)) > 0) {
      let written = 0;
      while (written < bytesRead) {
        written += fs.writeSync(outputDescriptor, buffer, written, bytesRead - written, null);
      }
    }
  } finally {
    if (outputDescriptor !== undefined) fs.closeSync(outputDescriptor);
    fs.closeSync(fileDescriptor);
  }
}
