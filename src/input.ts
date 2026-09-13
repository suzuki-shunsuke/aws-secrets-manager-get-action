import { load } from "js-yaml";

/** One secret value to read out of a secret holding a JSON object. */
export type Value = {
  key: string;
  output_name: string;
};

/** One secret to get from AWS Secrets Manager. */
export type Secret = {
  secret_id: string;
  version_id?: string;
  version_stage?: string;
  output_name: string;
  values: Value[];
};

/**
 * The fields each element of the secrets input takes.
 *
 * An unknown field is rejected rather than ignored, because a typo in a
 * workflow file would otherwise read the wrong secret, or output it under the
 * wrong name, without saying so.
 */
const secretFields = new Set([
  "secret_id",
  "version_id",
  "version_stage",
  "output_name",
  "values",
]);

const valueFields = new Set(["key", "output_name"]);

/**
 * This function reads a required string field.
 *
 * The field name is in the message because the secrets input is a list, and
 * "secret_id is required" is the only part a caller can act on.
 */
const requiredString = (
  record: Record<string, unknown>,
  field: string,
): string => {
  const value = record[field];
  if (value === undefined) {
    throw new Error(`${field} is required`);
  }
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }
  return value;
};

const optionalString = (
  record: Record<string, unknown>,
  field: string,
): string | undefined => {
  const value = record[field];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }
  return value;
};

const asRecord = (value: unknown, what: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${what} must be an object`);
  }
  return value as Record<string, unknown>;
};

const rejectUnknownFields = (
  record: Record<string, unknown>,
  allowed: Set<string>,
): void => {
  for (const field of Object.keys(record)) {
    if (!allowed.has(field)) {
      throw new Error(`unknown field ${field}`);
    }
  }
};

export const parseInputSecretValue = (value: unknown): Value => {
  const record = asRecord(value, "values element");
  rejectUnknownFields(record, valueFields);
  const key = requiredString(record, "key");
  // output_name defaults to key, so a secret whose keys are already good output
  // names doesn't have to repeat them.
  return { key, output_name: optionalString(record, "output_name") ?? key };
};

export const parseInputSecret = (value: unknown): Secret => {
  const record = asRecord(value, "secrets element");
  rejectUnknownFields(record, secretFields);

  const secret: Secret = {
    secret_id: requiredString(record, "secret_id"),
    version_id: optionalString(record, "version_id"),
    version_stage: optionalString(record, "version_stage"),
    output_name: "",
    values: [],
  };

  if (record.values === undefined) {
    // output_name defaults to secret_id, which is what a caller naming a secret
    // after the output it wants would have typed.
    secret.output_name =
      optionalString(record, "output_name") ?? secret.secret_id;
    return secret;
  }

  // output_name is meaningless when values is set, because then each value
  // carries its own output name. It's left empty rather than defaulted so that
  // nothing downstream reads it by accident.
  if (!Array.isArray(record.values)) {
    throw new Error("values must be an array");
  }
  for (const value of record.values) {
    secret.values.push(parseInputSecretValue(value));
  }
  return secret;
};

/**
 * The output name the JSON of every secret takes.
 *
 * A secret can't be output under it, because the JSON would overwrite the
 * secret and the workflow would read an object where it expected one value.
 */
const reservedOutputName = "secrets";

/** The output names one element of the input produces. */
const outputNames = (secret: Secret): string[] =>
  secret.values.length === 0
    ? [secret.output_name]
    : secret.values.map((value) => value.output_name);

/**
 * This function checks that every output has its own name.
 *
 * Two secrets sharing a name would leave only one of them readable, and which
 * one depends on the order of the input. Since a name defaults to the secret id
 * or the key, a collision is easy to write by accident.
 */
const validateOutputNames = (secrets: Secret[]): void => {
  const seen = new Set<string>();
  for (const secret of secrets) {
    for (const name of outputNames(secret)) {
      if (name === reservedOutputName) {
        throw new Error(
          `the output name ${reservedOutputName} is reserved for the JSON of every secret: set output_name to something else`,
        );
      }
      if (seen.has(name)) {
        throw new Error(
          `the output name ${name} is used twice: set output_name to tell them apart`,
        );
      }
      seen.add(name);
    }
  }
};

/**
 * This function parses the secrets input.
 *
 * The input is YAML rather than JSON because it's written by hand in a workflow
 * file.
 */
export const parseInputSecrets = (secretsYAML: string): Secret[] => {
  const data: unknown = load(secretsYAML);
  if (!Array.isArray(data)) {
    throw new Error("the secrets input must be an array");
  }
  if (data.length === 0) {
    throw new Error("the secrets input must not be empty");
  }
  const secrets = data.map(parseInputSecret);
  validateOutputNames(secrets);
  return secrets;
};
