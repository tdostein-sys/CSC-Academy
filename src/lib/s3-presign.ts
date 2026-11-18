import { createHash, createHmac } from 'node:crypto';

/**
 * Liens pré-signés « AWS Signature V4 » pour un stockage compatible S3
 * (Cloudflare R2, AWS S3…), sans dépendance externe.
 * Un lien pré-signé autorise UNE opération (lecture, suppression) sur UN
 * fichier pendant une durée limitée, sans jamais exposer la clé secrète.
 * https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
 */
export interface PresignInput {
  method: 'GET' | 'DELETE' | 'HEAD';
  /** Origine du stockage, ex. https://<compte>.r2.cloudflarestorage.com */
  endpoint: string;
  /** Chemin complet : /<bucket>/<clé> (adressage « path-style ») ou /<clé>. */
  path: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Durée de validité en secondes (1 à 604 800). */
  expiresIn: number;
  /** Paramètres supplémentaires signés (ex. response-content-type). */
  query?: Record<string, string>;
  now?: Date;
}

/** Encodage RFC 3986 exigé par SigV4. */
export function rfc3986(v: string): string {
  return encodeURIComponent(v).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

const sha256 = (v: string) => createHash('sha256').update(v, 'utf8').digest('hex');
const hmac = (key: Buffer | string, v: string) => createHmac('sha256', key).update(v, 'utf8').digest();

function amzDate(d: Date) {
  const iso = d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return { datetime: iso, date: iso.slice(0, 8) };
}

export function presignUrl(input: PresignInput): string {
  const origin = new URL(input.endpoint);
  const host = origin.host;
  const { datetime, date } = amzDate(input.now ?? new Date());
  const scope = `${date}/${input.region}/s3/aws4_request`;
  const expires = Math.min(Math.max(Math.floor(input.expiresIn), 1), 604800);

  const params: Record<string, string> = {
    ...(input.query ?? {}),
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${input.accessKeyId}/${scope}`,
    'X-Amz-Date': datetime,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host',
  };
  const canonicalQuery = Object.keys(params)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(params[k])}`)
    .join('&');
  const canonicalPath = input.path
    .split('/')
    .map((seg) => rfc3986(seg))
    .join('/');

  const canonicalRequest = [input.method, canonicalPath, canonicalQuery, `host:${host}`, '', 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', datetime, scope, sha256(canonicalRequest)].join('\n');
  const kDate = hmac(`AWS4${input.secretAccessKey}`, date);
  const kRegion = hmac(kDate, input.region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  return `${origin.protocol}//${host}${canonicalPath}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
