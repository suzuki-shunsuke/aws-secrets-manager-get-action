import { afterEach, describe, expect, it } from "vitest";
import { regionFromSecretId, resolveRegion } from "./region";

const arn = "arn:aws:secretsmanager:us-east-2:123456789012:secret:test1-a1b2c3";

describe("regionFromSecretId", () => {
  it("reads the region out of an ARN", () => {
    expect(regionFromSecretId(arn)).toBe("us-east-2");
  });

  it("returns an empty string for a secret name", () => {
    expect(regionFromSecretId("test1")).toBe("");
  });
});

describe("resolveRegion", () => {
  afterEach(() => {
    delete process.env.AWS_REGION;
    delete process.env.AWS_DEFAULT_REGION;
  });

  it("prefers the ARN over the input", () => {
    expect(resolveRegion({ region: "us-west-1", secretId: arn })).toBe(
      "us-east-2",
    );
  });

  it("falls back to the input", () => {
    expect(resolveRegion({ region: "us-west-1", secretId: "test1" })).toBe(
      "us-west-1",
    );
  });

  it("falls back to AWS_REGION", () => {
    process.env.AWS_REGION = "ap-northeast-1";
    expect(resolveRegion({ region: "", secretId: "test1" })).toBe(
      "ap-northeast-1",
    );
  });

  it("falls back to AWS_DEFAULT_REGION", () => {
    process.env.AWS_DEFAULT_REGION = "eu-west-1";
    expect(resolveRegion({ region: "", secretId: "test1" })).toBe("eu-west-1");
  });

  it("fails when nothing says which region the secret is in", () => {
    expect(() => resolveRegion({ region: "", secretId: "test1" })).toThrowError(
      "the AWS region of the secret test1 is unknown: set the 'region' input, pass 'secret_id' as an ARN, which carries the region, or set AWS_REGION",
    );
  });
});
