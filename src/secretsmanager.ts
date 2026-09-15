import { AwsClient } from "aws4fetch";
import type { Credentials } from "./credentials";

/**
 * The part of fetch which this module uses.
 *
 * globalThis.fetch satisfies this type, so it's only worth passing to stub the
 * Secrets Manager API in tests.
 */
export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export type Inputs = {
  credentials: Credentials;
  region: string;
  secretId: string;
  versionId?: string;
  versionStage?: string;
  /** It defaults to globalThis.fetch, and exists so tests can stub it. */
  fetch?: Fetch;
};

/** The part of a GetSecretValue response which this action uses. */
export type SecretValue = {
  SecretString?: string;
};

/**
 * This function reads the error an API call returned.
 *
 * Secrets Manager answers a failure with a JSON body naming the exception, and
 * that name is the whole diagnosis: ResourceNotFoundException means the secret
 * isn't there, AccessDeniedException means the IAM role may not read it. A bare
 * status code says neither.
 */
const errorMessage = (status: number, body: string): string => {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === "object" && parsed !== null) {
      const { __type, message, Message } = parsed as Record<string, unknown>;
      const type = typeof __type === "string" ? __type.split("#").pop() : "";
      const detail = message ?? Message;
      if (type || typeof detail === "string") {
        return `${status}${type ? ` ${type}` : ""}${typeof detail === "string" ? `: ${detail}` : ""}`;
      }
    }
  } catch {
    // The body wasn't JSON, so it's shown as it is.
  }
  return `${status}: ${body}`;
};

/**
 * This function calls the Secrets Manager GetSecretValue API.
 *
 * Secrets Manager speaks JSON over HTTPS, so the request is the operation name
 * in the x-amz-target header and a JSON body, signed with SigV4 by aws4fetch.
 * The AWS SDK isn't used because it's bundled into this action and every job
 * downloads it: @aws-sdk/client-secrets-manager adds over a megabyte to a
 * bundle to make one API call.
 */
export const getSecretValue = async (inputs: Inputs): Promise<SecretValue> => {
  const client = new AwsClient({
    ...inputs.credentials,
    service: "secretsmanager",
    region: inputs.region,
  });
  const request = await client.sign(
    `https://secretsmanager.${inputs.region}.amazonaws.com/`,
    {
      method: "POST",
      headers: {
        "content-type": "application/x-amz-json-1.1",
        "x-amz-target": "secretsmanager.GetSecretValue",
      },
      body: JSON.stringify({
        SecretId: inputs.secretId,
        VersionId: inputs.versionId,
        VersionStage: inputs.versionStage,
      }),
    },
  );
  const doFetch = inputs.fetch ?? globalThis.fetch;
  const response = await doFetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: await request.text(),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `failed to get the secret ${inputs.secretId}: ${errorMessage(response.status, body)}`,
    );
  }
  return JSON.parse(body) as SecretValue;
};
