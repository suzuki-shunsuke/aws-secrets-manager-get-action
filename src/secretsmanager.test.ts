import { describe, expect, it } from "vitest";
import { getSecretValue, type Fetch } from "./secretsmanager";

const credentials = {
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  sessionToken: "session-token",
};

type Call = {
  url: string;
  headers: Headers;
  body: string;
};

/** A fetch returning the given response and recording the request it got. */
const fakeFetch = (
  status: number,
  body: string,
): { fetch: Fetch; calls: Call[] } => {
  const calls: Call[] = [];
  return {
    calls,
    fetch: (url, init) => {
      calls.push({
        url,
        headers: new Headers(init?.headers),
        body: String(init?.body ?? ""),
      });
      return Promise.resolve(new Response(body, { status }));
    },
  };
};

describe("getSecretValue", () => {
  it("signs a GetSecretValue request and returns the secret", async () => {
    const { fetch, calls } = fakeFetch(200, '{"SecretString":"s3cret"}');

    expect(
      await getSecretValue({
        credentials,
        region: "us-east-2",
        secretId: "foo",
        versionStage: "AWSPREVIOUS",
        fetch,
      }),
    ).toEqual({ SecretString: "s3cret" });

    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call.url).toBe("https://secretsmanager.us-east-2.amazonaws.com/");
    expect(call.headers.get("x-amz-target")).toBe(
      "secretsmanager.GetSecretValue",
    );
    expect(call.headers.get("content-type")).toBe("application/x-amz-json-1.1");
    expect(call.headers.get("x-amz-security-token")).toBe("session-token");
    expect(call.headers.get("authorization")).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\/\d{8}\/us-east-2\/secretsmanager\/aws4_request,/,
    );
    // VersionId is absent, so JSON.stringify drops it rather than sending null.
    expect(JSON.parse(call.body)).toEqual({
      SecretId: "foo",
      VersionStage: "AWSPREVIOUS",
    });
  });

  it("sends no session token header when there is no session token", async () => {
    const { fetch, calls } = fakeFetch(200, '{"SecretString":"s3cret"}');

    await getSecretValue({
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
      region: "us-east-2",
      secretId: "foo",
      fetch,
    });

    expect(calls[0].headers.get("x-amz-security-token")).toBeNull();
    expect(calls[0].headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 /);
  });

  it("names the exception the API returned", async () => {
    const { fetch } = fakeFetch(
      400,
      '{"__type":"ResourceNotFoundException","message":"Secrets Manager can\'t find the specified secret."}',
    );

    await expect(
      getSecretValue({
        credentials,
        region: "us-east-2",
        secretId: "foo",
        fetch,
      }),
    ).rejects.toThrowError(
      "failed to get the secret foo: 400 ResourceNotFoundException: Secrets Manager can't find the specified secret.",
    );
  });

  it("shows a body that isn't JSON as it is", async () => {
    const { fetch } = fakeFetch(503, "Service Unavailable");

    await expect(
      getSecretValue({
        credentials,
        region: "us-east-2",
        secretId: "foo",
        fetch,
      }),
    ).rejects.toThrowError(
      "failed to get the secret foo: 503: Service Unavailable",
    );
  });
});
