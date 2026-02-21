import type { IAudioMetadata } from "music-metadata-browser";

/**
 * MP3 ID3v2.3 Tagger Utility
 * Generates an ID3v2.3 tag buffer that can be prepended to an MP3 file.
 */
export function generateID3v2Tag(metadata: IAudioMetadata | undefined): Uint8Array {
    if (!metadata || !metadata.common) return new Uint8Array(0);

    const common = metadata.common;
    const frames: { id: string; body: Uint8Array }[] = [];

    // Helper to create a text frame (TIT2, TPE1, etc.)
    const createTextFrame = (id: string, text: string | undefined) => {
        if (!text) return null;

        // For ID3v2.3, we use encoding 1 (UTF-16 with BOM).
        const BOM = [0xFF, 0xFE]; // Little Endian BOM
        const encodedText: number[] = [];
        for (let i = 0; i < text.length; i++) {
            const code = text.charCodeAt(i);
            encodedText.push(code & 0xFF);
            encodedText.push((code >> 8) & 0xFF);
        }

        const body = new Uint8Array([1, ...BOM, ...encodedText]); // 1 = UTF-16
        return { id, body };
    };

    const titleFrame = createTextFrame("TIT2", common.title);
    if (titleFrame) frames.push(titleFrame);

    const artistFrame = createTextFrame("TPE1", common.artist);
    if (artistFrame) frames.push(artistFrame);

    const albumFrame = createTextFrame("TALB", common.album);
    if (albumFrame) frames.push(albumFrame);

    const yearFrame = createTextFrame("TYER", common.year ? String(common.year) : undefined);
    if (yearFrame) frames.push(yearFrame);

    if (common.genre && common.genre[0]) {
        const genreFrame = createTextFrame("TCON", common.genre[0]);
        if (genreFrame) frames.push(genreFrame);
    }

    // Handle Artwork (APIC)
    if (common.picture && common.picture[0]) {
        const pic = common.picture[0];
        const mimeType = pic.format || "image/jpeg";
        const mimeEncoded = new TextEncoder().encode(mimeType);

        const headerSize = 1 + mimeEncoded.length + 1 + 1 + 1;
        const body = new Uint8Array(headerSize + pic.data.length);
        let pos = 0;
        body[pos++] = 0; // ISO-8859-1 for mime/desc
        body.set(mimeEncoded, pos);
        pos += mimeEncoded.length;
        body[pos++] = 0; // Null terminator for mime
        body[pos++] = 3; // Cover (front)
        body[pos++] = 0; // Null terminator for description
        body.set(pic.data, pos);

        frames.push({ id: "APIC", body });
    }

    if (frames.length === 0) return new Uint8Array(0);

    // Calculate total frames size
    let framesSize = 0;
    frames.forEach(f => {
        framesSize += 10 + f.body.length; // 10 bytes header per frame
    });

    // ID3v2 Header (10 bytes)
    const tagBuffer = new Uint8Array(10 + framesSize);
    tagBuffer.set([0x49, 0x44, 0x33, 0x03, 0x00, 0x00]); // ID3v2.3.0

    // Synchsafe integer (7 bits per byte)
    const sizeBytes = [
        (framesSize >> 21) & 0x7F,
        (framesSize >> 14) & 0x7F,
        (framesSize >> 7) & 0x7F,
        framesSize & 0x7F
    ];
    tagBuffer.set(sizeBytes, 6);

    let offset = 10;
    frames.forEach(f => {
        // Frame Header: ID (4) + Size (4) + Flags (2)
        for (let i = 0; i < 4; i++) tagBuffer[offset + i] = f.id.charCodeAt(i);

        // Frame size is NOT synchsafe in ID3v2.3 (only V2.4)
        tagBuffer[offset + 4] = (f.body.length >> 24) & 0xFF;
        tagBuffer[offset + 5] = (f.body.length >> 16) & 0xFF;
        tagBuffer[offset + 6] = (f.body.length >> 8) & 0xFF;
        tagBuffer[offset + 7] = f.body.length & 0xFF;

        tagBuffer[offset + 8] = 0; // Flags
        tagBuffer[offset + 9] = 0;

        tagBuffer.set(f.body, offset + 10);
        offset += 10 + f.body.length;
    });

    return tagBuffer;
}
