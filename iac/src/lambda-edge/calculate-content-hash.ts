/**
 * This code is based on the example from:
 * https://github.com/joe-king-sh/lambda-function-urls-with-post-put-sample/blob/main/iac/lib/lambda-edge/calculate-content-hash.ts
 *
 * CloudFront Lambda@Edge function to add a content hash header to requests.
 * This function is triggered on viewer request events.
 */

import type {
  CloudFrontRequestEvent,
  CloudFrontRequestHandler,
} from 'aws-lambda';

const hashPayload = async (payload: string) => {
  const encoder = new TextEncoder().encode(payload);
  const hash = await crypto.subtle.digest('SHA-256', encoder);
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray.map((bytes) => bytes.toString(16).padStart(2, '0')).join('');
};

export const handler: CloudFrontRequestHandler = async (
  event: CloudFrontRequestEvent
) => {
  const request = event.Records[0].cf.request;
  console.log('originalRequest', JSON.stringify(request));

  if (!request.body?.data) {
    return request;
  }

  const body = request.body.data;
  const decodedBody = Buffer.from(body, 'base64').toString('utf-8');

  request.headers['x-amz-content-sha256'] = [
    { key: 'x-amz-content-sha256', value: await hashPayload(decodedBody) },
  ];
  console.log('modifiedRequest', JSON.stringify(request));

  return request;
};
