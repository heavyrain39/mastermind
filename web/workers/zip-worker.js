/**
 * ZIP Compression Web Worker
 *
 * JSZip이 대용량 파일을 압축할 때 메인 스레드를 점유하는 문제를 해결하기 위해,
 * 압축 로직을 별도 워커 스레드에서 수행합니다.
 *
 * Message format:
 *  Request:  { type: 'GENERATE_ZIP', id: number, data: { files: { name: string, data: ArrayBuffer | Blob }[] } }
 *  Progress: { id: number, type: 'PROGRESS', progress: number }
 *  Response: { id: number, success: true, result: { zipBlob: Blob } }
 *  Error:    { id: number, success: false, error: string }
 */

// JSZip을 워커 컨텍스트에 로드합니다.
importScripts('/lib/jszip.min.js');

self.onmessage = async function (event) {
    const { type, id, data } = event.data;

    if (type !== 'GENERATE_ZIP') {
        self.postMessage({ id: id, success: false, error: `Unknown message type: ${type}` });
        return;
    }

    try {
        const zip = new JSZip();
        const files = data.files;

        for (const file of files) {
            zip.file(file.name, file.data);
        }

        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        }, (metadata) => {
            // metadata.percent를 메인 스레드에 보고
            self.postMessage({ id: id, type: 'PROGRESS', progress: Math.round(metadata.percent) });
        });

        self.postMessage({ id: id, success: true, result: { zipBlob: zipBlob } });
    } catch (err) {
        self.postMessage({ id: id, success: false, error: err && err.message ? err.message : String(err) });
    }
};
