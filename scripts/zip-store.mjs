import {
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const UTF8_FLAG = 0x0800;
const STORED_METHOD = 0;
const ZIP_VERSION = 20;
const MAX_UINT16 = 0xffff;
const MAX_UINT32 = 0xffffffff;

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

export function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function normalizedZipPath(value) {
  return value.split(sep).join("/").replace(/^\/+/, "");
}

function fixedDosTimestamp() {
  // Fixed timestamps make repeated packages byte-for-byte reproducible.
  const year = 2026;
  const month = 1;
  const day = 1;
  const hour = 0;
  const minute = 0;
  const second = 0;
  return {
    time: (hour << 11) | (minute << 5) | Math.floor(second / 2),
    date: ((year - 1980) << 9) | (month << 5) | day
  };
}

async function collectDirectory(rootDirectory, zipPrefix, filter) {
  const root = resolve(rootDirectory);
  const entries = [];

  async function walk(currentDirectory) {
    const directoryEntries = await readdir(currentDirectory, { withFileTypes: true });
    directoryEntries.sort((left, right) => left.name.localeCompare(right.name, "en"));

    for (const directoryEntry of directoryEntries) {
      const absolutePath = join(currentDirectory, directoryEntry.name);
      const relativePath = normalizedZipPath(relative(root, absolutePath));
      if (filter && !filter(relativePath, directoryEntry)) continue;

      if (directoryEntry.isDirectory()) {
        await walk(absolutePath);
      } else if (directoryEntry.isFile()) {
        entries.push({
          name: normalizedZipPath(`${zipPrefix}/${relativePath}`),
          sourcePath: absolutePath
        });
      }
    }
  }

  await walk(root);
  return entries;
}

export async function filesFromDirectory(rootDirectory, zipPrefix, filter) {
  return collectDirectory(rootDirectory, zipPrefix, filter);
}

export async function createStoredZip(destination, inputEntries) {
  if (inputEntries.length > MAX_UINT16) {
    throw new Error(`ZIP 文件数量超过经典 ZIP 上限：${inputEntries.length}`);
  }

  const entries = [...inputEntries].sort((left, right) => left.name.localeCompare(right.name, "en"));
  const duplicateNames = entries.filter(
    (entry, index) => index > 0 && entry.name === entries[index - 1].name
  );
  if (duplicateNames.length > 0) {
    throw new Error(`ZIP 内出现重复路径：${duplicateNames[0].name}`);
  }

  await mkdir(dirname(destination), { recursive: true });
  const temporaryDestination = `${destination}.tmp`;
  const output = await open(temporaryDestination, "w");
  const centralRecords = [];
  let offset = 0;
  const { time, date } = fixedDosTimestamp();

  try {
    for (const entry of entries) {
      const fileName = normalizedZipPath(entry.name);
      const fileNameBuffer = Buffer.from(fileName, "utf8");
      const contents =
        entry.contents === undefined
          ? await readFile(entry.sourcePath)
          : Buffer.isBuffer(entry.contents)
            ? entry.contents
            : Buffer.from(entry.contents, "utf8");

      if (contents.length > MAX_UINT32 || offset > MAX_UINT32) {
        throw new Error(`文件过大，无法写入经典 ZIP：${fileName}`);
      }

      const checksum = crc32(contents);
      const localOffset = offset;
      const localHeader = Buffer.alloc(30);
      localHeader.writeUInt32LE(LOCAL_FILE_HEADER, 0);
      localHeader.writeUInt16LE(ZIP_VERSION, 4);
      localHeader.writeUInt16LE(UTF8_FLAG, 6);
      localHeader.writeUInt16LE(STORED_METHOD, 8);
      localHeader.writeUInt16LE(time, 10);
      localHeader.writeUInt16LE(date, 12);
      localHeader.writeUInt32LE(checksum, 14);
      localHeader.writeUInt32LE(contents.length, 18);
      localHeader.writeUInt32LE(contents.length, 22);
      localHeader.writeUInt16LE(fileNameBuffer.length, 26);
      localHeader.writeUInt16LE(0, 28);

      await output.write(localHeader);
      await output.write(fileNameBuffer);
      await output.write(contents);
      offset += localHeader.length + fileNameBuffer.length + contents.length;

      centralRecords.push({
        fileNameBuffer,
        checksum,
        size: contents.length,
        localOffset
      });
    }

    const centralDirectoryOffset = offset;
    for (const record of centralRecords) {
      const header = Buffer.alloc(46);
      header.writeUInt32LE(CENTRAL_DIRECTORY_HEADER, 0);
      header.writeUInt16LE(ZIP_VERSION, 4);
      header.writeUInt16LE(ZIP_VERSION, 6);
      header.writeUInt16LE(UTF8_FLAG, 8);
      header.writeUInt16LE(STORED_METHOD, 10);
      header.writeUInt16LE(time, 12);
      header.writeUInt16LE(date, 14);
      header.writeUInt32LE(record.checksum, 16);
      header.writeUInt32LE(record.size, 20);
      header.writeUInt32LE(record.size, 24);
      header.writeUInt16LE(record.fileNameBuffer.length, 28);
      header.writeUInt16LE(0, 30);
      header.writeUInt16LE(0, 32);
      header.writeUInt16LE(0, 34);
      header.writeUInt16LE(0, 36);
      header.writeUInt32LE(0, 38);
      header.writeUInt32LE(record.localOffset, 42);

      await output.write(header);
      await output.write(record.fileNameBuffer);
      offset += header.length + record.fileNameBuffer.length;
    }

    const centralDirectorySize = offset - centralDirectoryOffset;
    if (centralDirectoryOffset > MAX_UINT32 || centralDirectorySize > MAX_UINT32) {
      throw new Error("ZIP 中央目录超过经典 ZIP 上限。");
    }

    const endRecord = Buffer.alloc(22);
    endRecord.writeUInt32LE(END_OF_CENTRAL_DIRECTORY, 0);
    endRecord.writeUInt16LE(0, 4);
    endRecord.writeUInt16LE(0, 6);
    endRecord.writeUInt16LE(centralRecords.length, 8);
    endRecord.writeUInt16LE(centralRecords.length, 10);
    endRecord.writeUInt32LE(centralDirectorySize, 12);
    endRecord.writeUInt32LE(centralDirectoryOffset, 16);
    endRecord.writeUInt16LE(0, 20);
    await output.write(endRecord);
  } finally {
    await output.close();
  }

  await rm(destination, { force: true });
  await rename(temporaryDestination, destination);
  const completedStats = await stat(destination);

  return {
    destination,
    entries: entries.length,
    bytes: completedStats.size
  };
}

function findEndRecord(buffer) {
  const minimumOffset = Math.max(0, buffer.length - 22 - MAX_UINT16);
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) return offset;
  }
  throw new Error("找不到 ZIP 中央目录结束标记。");
}

export async function readStoredZip(zipPath) {
  const archive = await readFile(zipPath);
  const endOffset = findEndRecord(archive);
  const entryCount = archive.readUInt16LE(endOffset + 10);
  const centralOffset = archive.readUInt32LE(endOffset + 16);
  const entries = [];
  let cursor = centralOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (archive.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_HEADER) {
      throw new Error(`ZIP 中央目录第 ${index + 1} 项损坏。`);
    }

    const method = archive.readUInt16LE(cursor + 10);
    const checksum = archive.readUInt32LE(cursor + 16);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const uncompressedSize = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const nameStart = cursor + 46;
    const name = archive.subarray(nameStart, nameStart + nameLength).toString("utf8");

    if (method !== STORED_METHOD || compressedSize !== uncompressedSize) {
      throw new Error(`此验证器只接受无压缩 ZIP 条目：${name}`);
    }
    if (archive.readUInt32LE(localOffset) !== LOCAL_FILE_HEADER) {
      throw new Error(`ZIP 本地文件头损坏：${name}`);
    }

    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const contents = archive.subarray(dataStart, dataStart + uncompressedSize);
    if (contents.length !== uncompressedSize || crc32(contents) !== checksum) {
      throw new Error(`ZIP 数据或 CRC 校验失败：${name}`);
    }

    entries.push({ name, contents: Buffer.from(contents) });
    cursor = nameStart + nameLength + extraLength + commentLength;
  }

  return entries;
}

export async function extractStoredZip(zipPath, destination) {
  const resolvedDestination = resolve(destination);
  const entries = await readStoredZip(zipPath);

  for (const entry of entries) {
    const outputPath = resolve(resolvedDestination, ...entry.name.split("/"));
    const expectedPrefix = `${resolvedDestination}${sep}`;
    if (outputPath !== resolvedDestination && !outputPath.startsWith(expectedPrefix)) {
      throw new Error(`拒绝解压越界路径：${entry.name}`);
    }
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, entry.contents);
  }

  return entries.map((entry) => entry.name);
}
