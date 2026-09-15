import process from "node:process";
import { credentials as oidcCredentials } from "@suzuki-shunsuke/actions-aws-oidc";

/** AWS credentials allowed to call secretsmanager:GetSecretValue. */
export type Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

/** A function returning AWS credentials. */
export type CredentialsProvider = () => Promise<Credentials>;

export type Inputs = {
  /** The role_to_assume input. Empty means the environment variables are read. */
  roleArn: string;
  /**
   * The region whose STS endpoint is called.
   *
   * Empty leaves @suzuki-shunsuke/actions-aws-oidc on the global endpoint
   * sts.amazonaws.com, which works from anywhere in the aws partition.
   */
  region: string;
};

/**
 * This function reads credentials out of the environment.
 *
 * These are the variables aws-actions/configure-aws-credentials exports, so a
 * workflow that already runs it keeps working. They're the only other source: a
 * profile in ~/.aws/credentials, IMDS on a self-hosted EC2 runner and the
 * credentials of an ECS or EKS task aren't read.
 */
const credentialsFromEnv = (): Credentials => {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "no AWS credentials: set the 'role_to_assume' input, or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY",
    );
  }
  return {
    accessKeyId,
    secretAccessKey,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  };
};

/**
 * This function builds the credentials provider the Secrets Manager calls use.
 *
 * When role_to_assume is set, the IAM role is assumed here with the GitHub OIDC
 * token and the credentials never leave this process. Later steps of the job
 * can't see them, unlike credentials that
 * aws-actions/configure-aws-credentials exports as environment variables or
 * writes to ~/.aws/credentials.
 *
 * The result is cached because @suzuki-shunsuke/actions-aws-oidc deliberately
 * assumes the role again on every call, and one run usually reads several
 * secrets. A session outlives a run of this action comfortably, so there's
 * nothing to refresh.
 */
export const newCredentials = (inputs: Inputs): CredentialsProvider => {
  // The environment is read in a Promise executor so that a missing variable
  // comes back as a rejection, the way a failure to assume the role does. A
  // caller awaiting the provider then has one thing to catch.
  const provider: CredentialsProvider = inputs.roleArn
    ? oidcCredentials({
        roleArn: inputs.roleArn,
        region: inputs.region || undefined,
      })
    : () => new Promise((resolve) => resolve(credentialsFromEnv()));

  let cache: Promise<Credentials> | undefined;
  return () => (cache ??= provider());
};
