import { afterEach, describe, expect, it, vi } from "vitest";
import { newCredentials } from "./credentials";

const sts = `<AssumeRoleWithWebIdentityResponse>
  <AssumeRoleWithWebIdentityResult>
    <Credentials>
      <AccessKeyId>ASIAEXAMPLE</AccessKeyId>
      <SecretAccessKey>secret</SecretAccessKey>
      <SessionToken>token</SessionToken>
      <Expiration>2026-09-13T00:00:00Z</Expiration>
    </Credentials>
  </AssumeRoleWithWebIdentityResult>
</AssumeRoleWithWebIdentityResponse>`;

describe("newCredentials", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_SESSION_TOKEN;
    delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
    delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  });

  it("reads the environment variables when role_to_assume isn't set", async () => {
    process.env.AWS_ACCESS_KEY_ID = "AKIAEXAMPLE";
    process.env.AWS_SECRET_ACCESS_KEY = "secret";
    process.env.AWS_SESSION_TOKEN = "token";

    expect(await newCredentials({ roleArn: "", region: "" })()).toEqual({
      accessKeyId: "AKIAEXAMPLE",
      secretAccessKey: "secret",
      sessionToken: "token",
    });
  });

  it("fails when neither role_to_assume nor the environment variables are set", async () => {
    await expect(
      newCredentials({ roleArn: "", region: "" })(),
    ).rejects.toThrowError(
      "no AWS credentials: set the 'role_to_assume' input, or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY",
    );
  });

  it("assumes the role once however often the credentials are asked for", async () => {
    process.env.ACTIONS_ID_TOKEN_REQUEST_URL =
      "https://example.com/token?foo=bar";
    process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN = "request-token";
    const fetch = vi.fn((url: string | URL | Request) =>
      Promise.resolve(
        String(url).startsWith("https://example.com/token")
          ? new Response(JSON.stringify({ value: "id-token" }))
          : new Response(sts),
      ),
    );
    vi.stubGlobal("fetch", fetch);

    const provider = newCredentials({
      roleArn: "arn:aws:iam::123456789012:role/example",
      region: "us-east-2",
    });
    expect(await provider()).toMatchObject({
      accessKeyId: "ASIAEXAMPLE",
      secretAccessKey: "secret",
      sessionToken: "token",
    });
    expect(await provider()).toMatchObject({ accessKeyId: "ASIAEXAMPLE" });

    // One OIDC token request and one AssumeRoleWithWebIdentity, not two of each.
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(fetch.mock.calls[1][0])).toBe(
      "https://sts.us-east-2.amazonaws.com/",
    );
  });
});
