import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import * as core from '@actions/core';
import { load } from 'js-yaml';

type Inputs = {
  secrets: string
}

type Secret = {
  output_name: string;
  secret_id: string;
  version_id: string;
  version_stage: string;
  values: Value[];
}

type Value = {
  key: string;
  output_name: string;
}

const allowedFields = new Set([
  "output_name",
  "secret_id",
  "version_id",
  "version_stage",
  "secret_arn",
  "values",
]);

const valuesKeys = new Set([
  "output_name",
  "key",
]);

const parseSecretStringJSON = (secretString: string): Map<string, string> => {
  const rawSecret: unknown = JSON.parse(secretString);
  if (typeof rawSecret !== "object") {
    throw new Error("secretString must be an object");
  }
  if (rawSecret === null) {
    throw new Error("secretString must not be a null");
  }
  const m = new Map<string, string>();
  for (const [key, value] of Object.entries(rawSecret)) {
    if (typeof value !== "string") {
      throw new Error("secret value must be a string");
    }
    m.set(key, value);
  }
  return m;
};

const setSecrets = async (secret: Secret, client: SecretsManagerClient, secrets: Map<string, string>): Promise<void> => {
  const command = new GetSecretValueCommand({
    SecretId: secret.secret_id,
    VersionId: secret.version_id,
    VersionStage: secret.version_stage,
  });
  const response = await client.send(command);
  if (response.SecretString === undefined) {
    throw new Error("SecretString is required");
  }
  if (secret.values.length === 0) {
    secrets.set(secret.output_name, response.SecretString);
    return;
  }
  const secretMap = parseSecretStringJSON(response.SecretString);
  for (const value of secret.values) {
    const secret = secretMap.get(value.output_name);
    if (secret === undefined) {
      throw new Error("secret isn't found");
    }
    secrets.set(value.output_name, secret);
  }
};

export const run = async (inputs: Inputs): Promise<void> => {
  const inputSecrets = parseInputSecrets(inputs.secrets);
  const client = new SecretsManagerClient();
  const secrets = new Map<string, string>;
  for (const elem of inputSecrets) {
    await setSecrets(elem, client, secrets);
  }
  for (const [key, value] of secrets) {
    core.setSecret(value);
    core.setOutput(key, value);
  }
  const secretsJSON = JSON.stringify(Object.fromEntries(secrets));
  core.setSecret(secretsJSON);
  core.setOutput("secrets", secretsJSON);
}

const parseInputSecretValue = (value: unknown): Value => {
  if (typeof value !== "object") {
    throw new Error("value must be an object");
  }
  if (value === null) {
    throw new Error("value must not be a null");
  }
  for (const key of Object.keys(value)) {
    if (!valuesKeys.has(key)) {
      throw new Error(`unknown field ${key}`);
    }
  }
  const record = value as Record<keyof Value, unknown>;

  if (record.key === undefined) {
    throw new Error("key is required");
  }
  if (typeof record.key !== "string") {
    throw new Error("key must be a string");
  }

  if (record.output_name === undefined) {
    return {
      key: record.key,
      output_name: record.key,
    };
  }
  if (typeof record.output_name !== "string") {
    throw new Error("output_name must be a string");
  }
  return {
    key: record.key,
    output_name: record.output_name,
  };
};

const parseInputSecret = (obj: object): Secret => {
  for (const key of Object.keys(obj)) {
    if (!allowedFields.has(key)) {
      throw new Error(`unknown field ${key}`);
    }
  }
  const record = obj as Record<keyof Secret, unknown>;

  if (record.secret_id === undefined) {
    throw new Error("secret_id is required");
  }
  if (typeof record.secret_id !== "string") {
    throw new Error("secret_id must be a string");
  }

  const secret: Secret = {
    secret_id: record.secret_id,
    output_name: "",
    version_id: "",
    version_stage: "",
    values: [],
  };

  if (record.version_id !== undefined) {
    if (typeof record.version_id !== "string") {
      throw new Error("version_id must be a string");
    }
    secret.version_id = record.version_id;
  }

  if (record.version_stage !== undefined) {
    if (typeof record.version_stage !== "string") {
      throw new Error("version_stage must be a string");
    }
    secret.version_stage = record.version_stage;
  }

  if (record.output_name !== undefined) {
    if (typeof record.output_name !== "string") {
      throw new Error("output_name must be a string");
    }
    secret.output_name = record.output_name;
  }

  if (record.values === undefined) {
    return secret;
  }

  if (!Array.isArray(record.values)) {
    throw new Error("values must be an Array");
  }
  for (const value of record.values) {
    secret.values.push(parseInputSecretValue(value));
  }
  return secret;
};

const parseInputSecrets = (secretsYAML: string): Secret[] => {
  const data: unknown = load(secretsYAML);
  if (!Array.isArray(data)) {
    throw new Error("secrets must be an Array");
  }
  if (!data.every((e) => typeof e === "object" && e !== null)) {
    throw new Error("all secrets elements must be an object");
  }
  const secrets: Secret[] = [];
  for (const elem of data) {
    secrets.push(parseInputSecret(elem));
  }
  return secrets;
};
