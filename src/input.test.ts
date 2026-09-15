import { describe, expect, it } from "vitest";
import { parseInputSecrets } from "./input";

describe("parseInputSecrets", () => {
  it("defaults output_name to secret_id", () => {
    expect(parseInputSecrets("- secret_id: foo")).toEqual([
      {
        secret_id: "foo",
        version_id: undefined,
        version_stage: undefined,
        output_name: "foo",
        values: [],
      },
    ]);
  });

  it("keeps an explicit output_name", () => {
    expect(
      parseInputSecrets(`
- secret_id: foo
  version_id: a1b2c3d4-5678-90ab-cdef-EXAMPLE22222
  version_stage: AWSPREVIOUS
  output_name: yoo_foo
`),
    ).toEqual([
      {
        secret_id: "foo",
        version_id: "a1b2c3d4-5678-90ab-cdef-EXAMPLE22222",
        version_stage: "AWSPREVIOUS",
        output_name: "yoo_foo",
        values: [],
      },
    ]);
  });

  it("defaults each value's output_name to its key and leaves output_name empty", () => {
    expect(
      parseInputSecrets(`
- secret_id: app
  values:
    - key: app_id
    - key: private_key
      output_name: app_private_key
`),
    ).toEqual([
      {
        secret_id: "app",
        version_id: undefined,
        version_stage: undefined,
        output_name: "",
        values: [
          { key: "app_id", output_name: "app_id" },
          { key: "private_key", output_name: "app_private_key" },
        ],
      },
    ]);
  });

  it("ignores output_name when values is set", () => {
    expect(
      parseInputSecrets(`
- secret_id: app
  output_name: ignored
  values:
    - key: app_id
`),
    ).toEqual([
      {
        secret_id: "app",
        version_id: undefined,
        version_stage: undefined,
        output_name: "",
        values: [{ key: "app_id", output_name: "app_id" }],
      },
    ]);
  });

  it("rejects an unknown field, such as the secret_arn the README used to document", () => {
    expect(() => parseInputSecrets("- secret_arn: foo")).toThrowError(
      "unknown field secret_arn",
    );
  });

  it("rejects a missing secret_id", () => {
    expect(() => parseInputSecrets("- output_name: foo")).toThrowError(
      "secret_id is required",
    );
  });

  it("rejects a secret_id that isn't a string", () => {
    expect(() => parseInputSecrets("- secret_id: 1")).toThrowError(
      "secret_id must be a string",
    );
  });

  it("rejects an unknown field in values", () => {
    expect(() =>
      parseInputSecrets("- secret_id: foo\n  values:\n    - name: bar"),
    ).toThrowError("unknown field name");
  });

  it("rejects values that isn't an array", () => {
    expect(() =>
      parseInputSecrets("- secret_id: foo\n  values: bar"),
    ).toThrowError("values must be an array");
  });

  it("rejects a map, which is the shape a caller writing YAML is likely to try", () => {
    expect(() => parseInputSecrets("secret_id: foo")).toThrowError(
      "the secrets input must be an array",
    );
  });

  it("rejects the reserved output name secrets", () => {
    expect(() => parseInputSecrets("- secret_id: secrets")).toThrowError(
      "the output name secrets is reserved for the JSON of every secret: set output_name to something else",
    );
  });

  it("rejects two secrets sharing an output name", () => {
    expect(() =>
      parseInputSecrets(
        "- secret_id: foo\n- secret_id: bar\n  output_name: foo",
      ),
    ).toThrowError(
      "the output name foo is used twice: set output_name to tell them apart",
    );
  });

  it("rejects two values sharing an output name", () => {
    expect(() =>
      parseInputSecrets(
        "- secret_id: foo\n  values:\n    - key: a\n    - key: b\n      output_name: a",
      ),
    ).toThrowError(
      "the output name a is used twice: set output_name to tell them apart",
    );
  });

  it("rejects an empty list", () => {
    expect(() => parseInputSecrets("[]")).toThrowError(
      "the secrets input must not be empty",
    );
  });
});
