import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function ensurePrivateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`Private output path must be a real directory: ${directory}`);
  }
  fs.chmodSync(directory, 0o700);
}

export function writePrivateJson(filePath, value) {
  ensurePrivateDirectory(path.dirname(filePath));
  const temporaryPath = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporaryPath, "wx", 0o600);
    fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporaryPath, filePath);
    fs.chmodSync(filePath, 0o600);
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    fs.rmSync(temporaryPath, { force: true });
    throw error;
  }
}
