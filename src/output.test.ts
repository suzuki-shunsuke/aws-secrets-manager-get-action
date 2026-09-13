import { describe, expect, it } from "vitest";
import type { Secret } from "./input";
import { parseSecretStringJSON, secretOutputs } from "./output";

const secret = (override: Partial<Secret>): Secret => ({
  secret_id: "foo",
  version_id: undefined,
  version_stage: undefined,
  output_name: "foo",
  values: [],
  ...override,
});

describe("parseSecretStringJSON", () => {
  it("reads a flat JSON object", () => {
    expect(
      parseSecretStringJSON('{"key1": "value1", "key2": "value2"}'),
    ).toEqual(
      new Map([
        ["key1", "value1"],
        ["key2", "value2"],
      ]),
    );
  });

  it("fails on a secret that isn't JSON", () => {
    expect(() => parseSecretStringJSON("not json")).toThrowError(
      "the secret isn't a JSON string. Remove 'values' to output the secret as it is",
    );
  });

  it("fails on a JSON value that isn't an object", () => {
    expect(() => parseSecretStringJSON('"foo"')).toThrowError(
      "the secret must be a JSON object",
    );
  });

  it("fails on a value that isn't a string", () => {
    expect(() => parseSecretStringJSON('{"key1": 1}')).toThrowError(
      "the secret value of the key key1 must be a string",
    );
  });
});

describe("secretOutputs", () => {
  it("outputs the whole secret string when values isn't set", () => {
    expect(secretOutputs(secret({}), { SecretString: "s3cret" })).toEqual(
      new Map([["foo", "s3cret"]]),
    );
  });

  it("outputs each value under its own output_name", () => {
    expect(
      secretOutputs(
        secret({
          output_name: "",
          values: [
            { key: "app_id", output_name: "app_id" },
            { key: "private_key", output_name: "app_private_key" },
          ],
        }),
        { SecretString: '{"app_id": "123456", "private_key": "pem"}' },
      ),
    ).toEqual(
      new Map([
        ["app_id", "123456"],
        ["app_private_key", "pem"],
      ]),
    );
  });

  it("fails when the secret has no such key", () => {
    expect(() =>
      secretOutputs(
        secret({
          output_name: "",
          values: [{ key: "app_id", output_name: "app_id" }],
        }),
        { SecretString: "{}" },
      ),
    ).toThrowError("the secret foo has no key app_id");
  });

  it("fails on a binary secret", () => {
    expect(() => secretOutputs(secret({}), {})).toThrowError(
      "this action doesn't support binary secrets",
    );
  });
});
