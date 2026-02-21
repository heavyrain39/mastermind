/**
 * MP3 Encoding Web Worker
 *
 * lamejs가 메인 스레드를 블로킹하는 문제를 해결하기 위해,
 * 인코딩 로직을 별도 워커 스레드에서 수행합니다.
 *
 * Message format:
 *  Request:  { type: 'ENCODE_MP3', id: number, data: { channels: Float32Array[], sampleRate: number, bitrate: number } }
 *  Progress: { id: number, type: 'PROGRESS', progress: number }
 *  Response: { id: number, success: true, result: { mp3Blob: Blob } }
 *  Error:    { id: number, success: false, error: string }
 */

// lamejs를 워커 컨텍스트에 로드합니다.
importScripts('/lib/lame.all.js');

function clampAndScale(sample) {
    const v = sample < -1 ? -1 : sample > 1 ? 1 : sample;
    return v < 0 ? v * 32768 : v * 32767;
}

/**
 * Float32Array 채널 데이터를 MP3 Blob으로 인코딩합니다.
 * 진행률을 id 기반으로 메인 스레드에 전송합니다.
 */
function encodeMp3(channels, sampleRate, bitrate, id) {
    const numberOfChannels = channels.length;
    const mp3encoder = new lamejs.Mp3Encoder(numberOfChannels, sampleRate, bitrate);
    const mp3Data = [];

    const sampleBlockSize = 1152;
    const length = channels[0].length;
    const totalBlocks = Math.ceil(length / sampleBlockSize);

    const leftData = new Int16Array(sampleBlockSize);
    const rightData = numberOfChannels > 1 ? new Int16Array(sampleBlockSize) : leftData;

    let lastReportedPercent = -1;

    for (let blockIndex = 0, offset = 0; offset < length; blockIndex++, offset += sampleBlockSize) {
        const end = Math.min(offset + sampleBlockSize, length);
        const chunkLength = end - offset;

        const leftChunk = chunkLength === sampleBlockSize ? leftData : new Int16Array(chunkLength);
        const rightChunk = numberOfChannels > 1
            ? (chunkLength === sampleBlockSize ? rightData : new Int16Array(chunkLength))
            : leftChunk;

        for (let i = 0; i < chunkLength; i++) {
            const idx = offset + i;
            leftChunk[i] = clampAndScale(channels[0][idx]);
            if (numberOfChannels > 1) {
                rightChunk[i] = clampAndScale(channels[1][idx]);
            }
        }

        let mp3buf;
        if (numberOfChannels > 1) {
            mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
        } else {
            mp3buf = mp3encoder.encodeBuffer(leftChunk);
        }

        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
        }

        // 진행률 보고 (5% 단위)
        const percent = Math.floor((blockIndex / totalBlocks) * 100);
        if (percent >= lastReportedPercent + 5) {
            lastReportedPercent = percent;
            self.postMessage({ id, type: 'PROGRESS', progress: percent });
        }
    }

    const flushBuf = mp3encoder.flush();
    if (flushBuf.length > 0) {
        mp3Data.push(flushBuf);
    }

    self.postMessage({ id, type: 'PROGRESS', progress: 100 });

    return new Blob(mp3Data, { type: 'audio/mp3' });
}

self.onmessage = function (event) {
    const { type, id, data } = event.data;

    if (type !== 'ENCODE_MP3') {
        self.postMessage({ id, success: false, error: `Unknown message type: ${type}` });
        return;
    }

    try {
        const { channels, sampleRate, bitrate } = data;
        const mp3Blob = encodeMp3(channels, sampleRate, bitrate, id);
        self.postMessage({ id, success: true, result: { mp3Blob } });
    } catch (err) {
        self.postMessage({ id, success: false, error: err && err.message ? err.message : String(err) });
    }
};
