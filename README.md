# aws-secrets-manager-get-action

GitHub Actions to get secrets from AWS Secrets Manager.

It assumes an AWS IAM role with the GitHub OIDC token itself, so the credentials stay inside
the action and no step of the job can read them.

## Usage

```yaml
jobs:
  example:
    runs-on: ubuntu-latest
    permissions:
      id-token: write # Required to get a GitHub OIDC token
    steps:
      - uses: suzuki-shunsuke/aws-secrets-manager-get-action@latest
        id: secrets
        with:
          role_to_assume: arn:aws:iam::123456789012:role/example
          region: us-east-2
          # secrets is required
          secrets: |
            - output_name: foo
              secret_id: foo
              # version_id: a1b2c3d4-5678-90ab-cdef-EXAMPLE22222
              version_stage: AWSPREVIOUS
            - secret_id: arn:aws:secretsmanager:us-east-2:123456789012:secret:test1-a1b2c3
            - secret_id: bar
              values:
                - key: api_key
                  output_name: bar_api_key

      - run: echo "$API_KEY" | do-something
        env:
          API_KEY: ${{steps.secrets.outputs.bar_api_key}}

      # Or pass every secret at once, each under its own output name.
      - run: do-something
        env: ${{fromJSON(steps.secrets.outputs.secrets)}}
```

## Inputs

### `secrets`

Required. A YAML string, which is a list of secret settings.

- `secret_id` (Required): AWS Secrets Manager's secret id. A secret ARN works too, and carries
  the region, so secrets from several regions can be read in one go
- `version_id` (Optional): AWS Secrets Manager's secret version id
- `version_stage` (Optional): AWS Secrets Manager's secret version stage
- `output_name` (Optional): The action's output name. The default is the same as `secret_id`.
  It is ignored if `values` is set, because then each value carries its own output name
- `values` (Optional): The list of secrets to read out of one secret. If `values` is set, the
  secret is treated as a JSON string that is a pairs of secret names and values
- `values[].key` (Required): The secret key
- `values[].output_name` (Optional): The action's output name. The default is the same as `key`

An unknown field is an error rather than being ignored, so a typo can't quietly read the wrong
secret.

### `role_to_assume`

Optional. The ARN of the AWS IAM role to assume with the GitHub OIDC token. The job needs the
permission `id-token: write`.

Leave it unset to read credentials from `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and
`AWS_SESSION_TOKEN` instead, which is what
[aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials)
exports. Those environment variables are the only other source: a profile in
`~/.aws/credentials`, IMDS on a self-hosted EC2 runner and the credentials of an ECS or EKS
task aren't read, so run `aws-actions/configure-aws-credentials` first to use any of them.

### `region`

Optional. The AWS region of the secrets, which is also the region of the STS endpoint when
`role_to_assume` is set.

It can be omitted for a secret whose `secret_id` is an ARN, which carries the region.
Otherwise it falls back to `AWS_REGION` or `AWS_DEFAULT_REGION`, and the action fails when none
of them says which region a secret is in.

## Outputs

Each secret is output under its own output name, which the `secrets` input decides.

`secrets` is a JSON string of all of them, keyed by output name. Pass it to a step with
`env: ${{fromJSON(steps.<id>.outputs.secrets)}}` to hand over every secret without naming them
one by one.

Every secret is masked with `::add-mask::`, so it doesn't appear in the workflow log.

## IAM permissions

The role needs `secretsmanager:GetSecretValue` on each secret, and its trust policy must allow
`sts:AssumeRoleWithWebIdentity` from the GitHub OIDC provider. Only those two APIs are called.

## Why not `aws-actions/aws-secretsmanager-get-secrets`?

https://github.com/aws-actions/aws-secretsmanager-get-secrets

That action writes the secrets to environment variables, which every later step of the job then
inherits, and it names them by transliterating the secret id rather than letting you choose:
https://github.com/aws-actions/aws-secretsmanager-get-secrets/issues/14

This action outputs them instead, under names you pick, so each step gets only the secrets it
needs.

It also assumes the IAM role itself. `aws-actions/configure-aws-credentials` either exports the
credentials as environment variables or writes them to `~/.aws/credentials`, and either way
every later step of the job can read them. Assuming the role here keeps them in this action's
own process, and the session lasts 900 seconds, the shortest AWS STS accepts. It saves a step
too, and GitHub Actions downloads each action separately, so one action fewer is one download
fewer.

The AWS SDK isn't used, for the same reason: only `secretsmanager:GetSecretValue` is called,
over HTTPS with a SigV4 signature from
[aws4fetch](https://github.com/mhart/aws4fetch). `@aws-sdk/client-secrets-manager` would add
over half a megabyte to the bundle that every job downloads.

## LICENSE

[MIT](LICENSE)
