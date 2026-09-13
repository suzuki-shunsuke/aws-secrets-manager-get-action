import process from "node:process";

/**
 * This function reads the region out of a secret ARN.
 *
 * An ARN looks like arn:aws:secretsmanager:<region>:<account>:secret:<name>, so
 * a caller passing one has already said where the secret is. A bare secret name
 * carries no region, and an empty string is returned.
 */
export const regionFromSecretId = (secretId: string): string => {
  if (!secretId.startsWith("arn:")) {
    return "";
  }
  return secretId.split(":")[3] ?? "";
};

export type Inputs = {
  /** The region input, which applies to every secret. */
  region: string;
  /** The secret_id of the secret being read. */
  secretId: string;
};

/**
 * This function works out which region a secret is in.
 *
 * A secret ARN wins over the region input and the environment variables,
 * because it states where the secret actually is while those are only defaults.
 * That's also what lets one run read secrets from several regions.
 */
export const resolveRegion = (inputs: Inputs): string => {
  const region =
    regionFromSecretId(inputs.secretId) ||
    inputs.region ||
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION;
  if (!region) {
    throw new Error(
      `the AWS region of the secret ${inputs.secretId} is unknown: set the 'region' input, pass 'secret_id' as an ARN, which carries the region, or set AWS_REGION`,
    );
  }
  return region;
};
