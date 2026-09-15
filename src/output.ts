import type { Secret } from "./input";
import type { SecretValue } from "./secretsmanager";

/**
 * This function reads a secret holding a JSON object.
 *
 * A secret created through the Secrets Manager console's key/value editor is
 * stored as a flat JSON object, which is what values selects from.
 */
export const parseSecretStringJSON = (
  secretString: string,
): Map<string, string> => {
  let rawSecret: unknown;
  try {
    rawSecret = JSON.parse(secretString);
  } catch {
    throw new Error(
      "the secret isn't a JSON string. Remove 'values' to output the secret as it is",
    );
  }
  if (typeof rawSecret !== "object" || rawSecret === null) {
    throw new Error("the secret must be a JSON object");
  }
  const m = new Map<string, string>();
  for (const [key, value] of Object.entries(rawSecret)) {
    if (typeof value !== "string") {
      throw new Error(`the secret value of the key ${key} must be a string`);
    }
    m.set(key, value);
  }
  return m;
};

/**
 * This function works out the outputs one secret produces.
 *
 * Without values the whole secret string is one output. With values the secret
 * is a JSON object and each value picks one key out of it, so one API call can
 * feed several outputs.
 */
export const secretOutputs = (
  secret: Secret,
  value: SecretValue,
): Map<string, string> => {
  const secretString = value.SecretString;
  if (secretString === undefined) {
    throw new Error("this action doesn't support binary secrets");
  }
  if (secret.values.length === 0) {
    return new Map([[secret.output_name, secretString]]);
  }
  const secretMap = parseSecretStringJSON(secretString);
  const outputs = new Map<string, string>();
  for (const v of secret.values) {
    const s = secretMap.get(v.key);
    if (s === undefined) {
      throw new Error(`the secret ${secret.secret_id} has no key ${v.key}`);
    }
    outputs.set(v.output_name, s);
  }
  return outputs;
};
