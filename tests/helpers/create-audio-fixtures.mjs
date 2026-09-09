import { mkdir, writeFile } from "node:fs/promises";

const sampleRate = 48000;
const length = sampleRate * 2;
const bytes = Buffer.alloc(44 + length * 4);
bytes.write("RIFF", 0);
bytes.writeUInt32LE(bytes.length - 8, 4);
bytes.write("WAVEfmt ", 8);
bytes.writeUInt32LE(16, 16);
bytes.writeUInt16LE(1, 20);
bytes.writeUInt16LE(2, 22);
bytes.writeUInt32LE(sampleRate, 24);
bytes.writeUInt32LE(sampleRate * 4, 28);
bytes.writeUInt16LE(4, 32);
bytes.writeUInt16LE(16, 34);
bytes.write("data", 36);
bytes.writeUInt32LE(length * 4, 40);
for (let i = 0; i < length; i++) {
  bytes.writeInt16LE(Math.round(0.2 * 32767 * Math.sin(2 * Math.PI * 440 * i / sampleRate)), 44 + i * 4);
  bytes.writeInt16LE(Math.round(0.18 * 32767 * Math.sin(2 * Math.PI * 441 * i / sampleRate)), 46 + i * 4);
}
await mkdir("output/playwright", { recursive: true });
await writeFile("output/playwright/review-tone.wav", bytes);
