// Web NFC API Types
declare global {
  interface Window {
    NDEFReader: typeof NDEFReader;
  }
}

declare class NDEFReader {
  constructor();
  scan(): Promise<void>;
  write(
    message: NDEFMessageInit,
    options?: NDEFWriteOptions
  ): Promise<void>;
  onreading: ((event: NDEFReadingEvent) => void) | null;
  onreadingerror: ((event: Event) => void) | null;
}

interface NDEFMessageInit {
  records: NDEFRecordInit[];
}

interface NDEFRecordInit {
  recordType: string;
  mediaType?: string;
  id?: string;
  data?: string | BufferSource;
  encoding?: string;
  lang?: string;
}

interface NDEFWriteOptions {
  overwrite?: boolean;
  signal?: AbortSignal;
}

interface NDEFReadingEvent extends Event {
  serialNumber: string;
  message: NDEFMessage;
}

interface NDEFMessage {
  records: NDEFRecord[];
}

interface NDEFRecord {
  recordType: string;
  mediaType?: string;
  id?: string;
  data?: DataView;
  encoding?: string;
  lang?: string;
  toRecords?: () => NDEFRecord[];
}

export interface NFCTagInfo {
  serialNumber: string;
  recordCount: number;
  records: ParsedRecord[];
}

export interface ParsedRecord {
  type: string;
  content: string;
  rawType: string;
}

// Check if Web NFC is supported
export function isNFCSupported(): boolean {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

// Parse NDEF record to human-readable content
function parseRecord(record: NDEFRecord): ParsedRecord {
  const decoder = new TextDecoder(record.encoding || 'utf-8');
  let content = '';
  let type = 'Unknown';

  if (record.data) {
    const dataView = record.data;
    const buffer = dataView.buffer.slice(
      dataView.byteOffset,
      dataView.byteOffset + dataView.byteLength
    );

    switch (record.recordType) {
      case 'text':
        content = decoder.decode(buffer);
        type = 'Text';
        break;
      case 'url':
        content = decoder.decode(buffer);
        type = 'URL';
        break;
      case 'mime':
        content = decoder.decode(buffer);
        type = record.mediaType || 'MIME';
        break;
      default:
        content = decoder.decode(buffer);
        type = record.recordType;
    }
  }

  return {
    type,
    content,
    rawType: record.recordType,
  };
}

// Read NFC Tag
export async function readNFCTag(): Promise<NFCTagInfo> {
  if (!isNFCSupported()) {
    throw new Error('Web NFC is not supported on this browser. Please use Chrome 89+ on Android.');
  }

  return new Promise((resolve, reject) => {
    const reader = new NDEFReader();

    reader.onreading = (event: NDEFReadingEvent) => {
      const records: ParsedRecord[] = [];
      
      for (const record of event.message.records) {
        records.push(parseRecord(record));
      }

      resolve({
        serialNumber: event.serialNumber,
        recordCount: event.message.records.length,
        records,
      });
    };

    reader.onreadingerror = () => {
      reject(new Error('Failed to read NFC tag. Please try again.'));
    };

    reader.scan().catch((error) => {
      reject(new Error(`NFC scan failed: ${error.message}`));
    });
  });
}

// Write Text to NFC Tag
export async function writeTextToNFC(text: string, lang: string = 'en'): Promise<void> {
  if (!isNFCSupported()) {
    throw new Error('Web NFC is not supported on this browser. Please use Chrome 89+ on Android.');
  }

  const reader = new NDEFReader();
  await reader.write({
    records: [
      {
        recordType: 'text',
        data: text,
        lang,
      },
    ],
  });
}

// Write URL to NFC Tag
export async function writeURLToNFC(url: string): Promise<void> {
  if (!isNFCSupported()) {
    throw new Error('Web NFC is not supported on this browser. Please use Chrome 89+ on Android.');
  }

  const reader = new NDEFReader();
  await reader.write({
    records: [
      {
        recordType: 'url',
        data: url,
      },
    ],
  });
}

// Write Email to NFC Tag
export async function writeEmailToNFC(
  email: string,
  subject?: string,
  body?: string
): Promise<void> {
  if (!isNFCSupported()) {
    throw new Error('Web NFC is not supported on this browser. Please use Chrome 89+ on Android.');
  }

  let mailtoUrl = `mailto:${email}`;
  const params: string[] = [];
  
  if (subject) {
    params.push(`subject=${encodeURIComponent(subject)}`);
  }
  if (body) {
    params.push(`body=${encodeURIComponent(body)}`);
  }
  
  if (params.length > 0) {
    mailtoUrl += `?${params.join('&')}`;
  }

  const reader = new NDEFReader();
  await reader.write({
    records: [
      {
        recordType: 'url',
        data: mailtoUrl,
      },
    ],
  });
}

// Write Phone Number to NFC Tag
export async function writePhoneToNFC(phone: string): Promise<void> {
  if (!isNFCSupported()) {
    throw new Error('Web NFC is not supported on this browser. Please use Chrome 89+ on Android.');
  }

  const reader = new NDEFReader();
  await reader.write({
    records: [
      {
        recordType: 'url',
        data: `tel:${phone}`,
      },
    ],
  });
}

// Write SMS to NFC Tag
export async function writeSMSToNFC(phone: string, message?: string): Promise<void> {
  if (!isNFCSupported()) {
    throw new Error('Web NFC is not supported on this browser. Please use Chrome 89+ on Android.');
  }

  let smsUrl = `sms:${phone}`;
  if (message) {
    smsUrl += `?body=${encodeURIComponent(message)}`;
  }

  const reader = new NDEFReader();
  await reader.write({
    records: [
      {
        recordType: 'url',
        data: smsUrl,
      },
    ],
  });
}

// Write WiFi to NFC Tag (using MIME type)
export async function writeWiFiToNFC(
  ssid: string,
  password: string,
  authType: 'WPA' | 'WEP' | 'nopass' = 'WPA'
): Promise<void> {
  if (!isNFCSupported()) {
    throw new Error('Web NFC is not supported on this browser. Please use Chrome 89+ on Android.');
  }

  // WiFi config string format
  const wifiConfig = `WIFI:T:${authType};S:${ssid};P:${password};;`;
  
  const reader = new NDEFReader();
  await reader.write({
    records: [
      {
        recordType: 'mime',
        mediaType: 'application/vnd.wfa.wsc',
        data: new TextEncoder().encode(wifiConfig),
      },
    ],
  });
}

