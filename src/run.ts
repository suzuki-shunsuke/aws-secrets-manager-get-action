import process from "node:process";
import * as core from "@actions/core";
import { newCredentials } from "./credentials";
import { parseInputSecrets } from "./input";
import { secretOutputs } from "./output";
import { resolveRegion } from "./region";
import { getSecretValue } from "./secretsmanager";
import { roleSessionName } from "./session_name";

/**
 * This function gets the secrets and outputs them.
 *
 * The input is parsed before anything else, so a typo in the workflow file
 * fails without a round trip to AWS STS.
 */
export const run = async (): Promise<void> => {
  const secrets = parseInputSecrets(
    core.getInput("secrets", { required: true }),
  );
  const region = core.getInput("region");
  const roleArn = core.getInput("role_to_assume");

  // The session is named after the workflow run so that a CloudTrail
  // GetSecretValue event says which run read the secret. See ./session_name.ts.
  const sessionName = roleSessionName({
    runId: process.env["GITHUB_RUN_ID"] ?? "",
    runAttempt: process.env["GITHUB_RUN_ATTEMPT"] ?? "",
  });
  if (roleArn) {
    core.info(
      `assuming an AWS IAM role with the GitHub OIDC token: ${roleArn} (session name: ${sessionName})`,
    );
  }
  const credentials = newCredentials({
    roleArn,
    region,
    roleSessionName: sessionName,
  });

  const outputs = new Map<string, string>();
  for (const secret of secrets) {
    // The region is worked out before the credentials, so a secret whose region
    // nothing states fails without a round trip to AWS STS.
    const secretRegion = resolveRegion({ region, secretId: secret.secret_id });
    const value = await getSecretValue({
      credentials: await credentials(),
      region: secretRegion,
      secretId: secret.secret_id,
      versionId: secret.version_id,
      versionStage: secret.version_stage,
    });
    for (const [name, s] of secretOutputs(secret, value)) {
      outputs.set(name, s);
    }
  }

  // Every secret is masked before any of them is output, so a failure partway
  // through the loop can't leave one unmasked.
  for (const [name, s] of outputs) {
    core.setSecret(s);
    core.setOutput(name, s);
  }
  // The aggregate output feeds `env: ${{fromJSON(steps.secrets.outputs.secrets)}}`,
  // which passes every secret to a step without naming them one by one.
  const secretsJSON = JSON.stringify(Object.fromEntries(outputs));
  core.setSecret(secretsJSON);
  core.setOutput("secrets", secretsJSON);
};
