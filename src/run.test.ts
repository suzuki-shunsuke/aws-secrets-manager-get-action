import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "./run";

/**
 * @actions/core writes outputs to the file GITHUB_OUTPUT names, so a temporary
 * one is the way to read back what the action produced.
 */
const readOutputs = (file: string): Map<string, string> => {
  const outputs = new Map<string, string>();
  // Each entry is `name<<delimiter\nvalue\ndelimiter`.
  const re = /^(.+?)<<(ghadelimiter_[^\n]+)\n([\s\S]*?)\n\2$/gm;
  const content = fs.readFileSync(file, "utf8");
  let m;
  while ((m = re.exec(content))) {
    outputs.set(m[1], m[3]);
  }
  return outputs;
};

describe("run", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "asmga-"));
    process.env.GITHUB_OUTPUT = path.join(dir, "output");
    fs.writeFileSync(process.env.GITHUB_OUTPUT, "");
    process.env.AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
    process.env.AWS_SECRET_ACCESS_KEY =
      "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.GITHUB_OUTPUT;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.INPUT_SECRETS;
    delete process.env.INPUT_REGION;
    delete process.env.INPUT_ROLE_TO_ASSUME;
  });

  it("outputs every secret and the JSON of all of them", async () => {
    process.env.INPUT_REGION = "us-east-2";
    process.env.INPUT_SECRETS = `
- secret_id: token
  output_name: github_token
- secret_id: arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:app-a1b2c3
  values:
    - key: app_id
    - key: private_key
      output_name: app_private_key
`;
    const bodies = new Map([
      ["token", '{"SecretString":"ghs_example"}'],
      [
        "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:app-a1b2c3",
        '{"SecretString":"{\\"app_id\\":\\"123456\\",\\"private_key\\":\\"pem\\"}"}',
      ],
    ]);
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        urls.push(String(url));
        const { SecretId } = JSON.parse(String(init?.body)) as {
          SecretId: string;
        };
        return Promise.resolve(new Response(bodies.get(SecretId)));
      }),
    );

    await run();

    expect(readOutputs(process.env.GITHUB_OUTPUT!)).toEqual(
      new Map([
        ["github_token", "ghs_example"],
        ["app_id", "123456"],
        ["app_private_key", "pem"],
        [
          "secrets",
          JSON.stringify({
            github_token: "ghs_example",
            app_id: "123456",
            app_private_key: "pem",
          }),
        ],
      ]),
    );
    // The second secret is an ARN, so its own region wins over the input.
    expect(urls).toEqual([
      "https://secretsmanager.us-east-2.amazonaws.com/",
      "https://secretsmanager.ap-northeast-1.amazonaws.com/",
    ]);
  });

  it("outputs nothing when a later secret fails", async () => {
    process.env.INPUT_REGION = "us-east-2";
    process.env.INPUT_SECRETS = "- secret_id: foo\n- secret_id: bar";
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        const { SecretId } = JSON.parse(String(init?.body)) as {
          SecretId: string;
        };
        return Promise.resolve(
          SecretId === "foo"
            ? new Response('{"SecretString":"s3cret"}')
            : new Response('{"__type":"ResourceNotFoundException"}', {
                status: 400,
              }),
        );
      }),
    );

    await expect(run()).rejects.toThrowError(
      "failed to get the secret bar: 400 ResourceNotFoundException",
    );
    // foo was read successfully, but nothing is output, so a half-finished run
    // can't leave a secret in an output that a later step would read as complete.
    expect(readOutputs(process.env.GITHUB_OUTPUT!).size).toBe(0);
  });
});
