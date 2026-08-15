import type { IAudioMetadata } from "music-metadata";

/**
 * MP3 ID3v2.3 Tagger Utility
 * Generates an ID3v2.3 tag buffer that can be prepended to an MP3 file.
 */
export function generateID3v2Tag(metadata: IAudioMetadata | undefined): Uint8Array {
  if (!metadata?.common) return new Uint8Array(0);

  const common = metadata.common;
  const frames: Uint8Array[] = [];

  const primaryArtist = firstNonEmpty(common.artist, common.artists?.[0], common.albumartist);
  const title = firstNonEmpty(common.title);
  const album = firstNonEmpty(common.album);
  const year = typeof common.year === "number" ? String(common.year) : undefined;
  const genre = common.genre?.[0];

  pushTextFrame(frames, "TIT2", title);
  pushTextFrame(frames, "TPE1", primaryArtist);
  pushTextFrame(frames, "TALB", album);
  pushTextFrame(frames, "TYER", year);
  pushTextFrame(frames, "TCON", genre);

  const picture = common.picture?.[0];
  if (picture?.data && picture.data.length > 0) {
    frames.push(createApicFrame(picture.format, picture.data));
  }

  if (frames.length === 0) return new Uint8Array(0);

  const framesSize = frames.reduce((sum, frame) => sum + frame.length, 0);
  const tagBuffer = new Uint8Array(10 + framesSize);

  // ID3 header: "ID3", version 2.3.0, flags 0
  tagBuffer.set([0x49, 0x44, 0x33, 0x03, 0x00, 0x00], 0);
  tagBuffer.set(toSynchsafe(framesSize), 6);

  let offset = 10;
  for (const frame of frames) {
    tagBuffer.set(frame, offset);
    offset += frame.length;
  }

  return tagBuffer;
}

function pushTextFrame(target: Uint8Array[], id: string, value: string | undefined) {
  const clean = cleanText(value);
  if (!clean) return;
  target.push(createFrame(id, encodeUtf16WithBomAndTerminator(clean)));
}

function cleanText(value: string | undefined) {
  if (!value) return undefined;
  const trimmed = value.replace(/\u0000/g, "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function firstNonEmpty(...values: Array<string | undefined>) {
  for (const value of values) {
    const clean = cleanText(value);
    if (clean) return clean;
  }
  return undefined;
}

function encodeUtf16WithBomAndTerminator(text: string) {
  // Text encoding byte 0x01 means UTF-16 with BOM in ID3v2.3.
  const body = new Uint8Array(1 + 2 + text.length * 2 + 2);
  let offset = 0;
  body[offset++] = 0x01;
  body[offset++] = 0xff;
  body[offset++] = 0xfe; // UTF-16LE BOM

  for (let i = 0; i < text.length; i += 1) {
    const codeUnit = text.charCodeAt(i);
    body[offset++] = codeUnit & 0xff;
    body[offset++] = (codeUnit >> 8) & 0xff;
  }

  // Explicit UTF-16 terminator
  body[offset++] = 0x00;
  body[offset++] = 0x00;
  return body;
}

function createApicFrame(format: string | undefined, imageData: Uint8Array) {
  const mimeType = (format && format.trim().length > 0) ? format.trim() : "image/jpeg";
  const mimeBytes = new TextEncoder().encode(mimeType);
  const description = new Uint8Array([0x00]); // ISO-8859-1 empty string terminator

  // APIC body:
  // [text-encoding(1)] [MIME + 0x00] [picture-type(1)] [description + 0x00] [binary image]
  const body = new Uint8Array(1 + mimeBytes.length + 1 + 1 + description.length + imageData.length);
  let offset = 0;
  body[offset++] = 0x00; // ISO-8859-1 for APIC text fields
  body.set(mimeBytes, offset);
  offset += mimeBytes.length;
  body[offset++] = 0x00;
  body[offset++] = 0x03; // front cover
  body.set(description, offset);
  offset += description.length;
  body.set(imageData, offset);

  return createFrame("APIC", body);
}

function createFrame(id: string, body: Uint8Array) {
  const frame = new Uint8Array(10 + body.length);
  frame[0] = id.charCodeAt(0);
  frame[1] = id.charCodeAt(1);
  frame[2] = id.charCodeAt(2);
  frame[3] = id.charCodeAt(3);

  // ID3v2.3 frame size is a regular 32-bit big-endian integer (not synchsafe).
  frame[4] = (body.length >> 24) & 0xff;
  frame[5] = (body.length >> 16) & 0xff;
  frame[6] = (body.length >> 8) & 0xff;
  frame[7] = body.length & 0xff;

  // Frame flags (status/format): all zero.
  frame[8] = 0x00;
  frame[9] = 0x00;
  frame.set(body, 10);
  return frame;
}

function toSynchsafe(size: number): [number, number, number, number] {
  return [
    (size >> 21) & 0x7f,
    (size >> 14) & 0x7f,
    (size >> 7) & 0x7f,
    size & 0x7f
  ];
}
