# aws-secrets-manager-get-action

GitHub Actions to get secrets from AWS Secrets Manager

## Usage

```yaml
- uses: suzuki-shunsuke/aws-secrets-manager-get-action@main
  id: secrets
  with:
    # secrets is required
    secrets: |
      - output_name: foo
        secret_id: foo
        # version_id: a1b2c3d4-5678-90ab-cdef-EXAMPLE22222
        version_stage: AWSPREVIOUS
      - secret_arn: arn:aws:secretsmanager:us-east-2:123456789012:secret:test1-a1b2c3
      - secret_id: bar
        values:
          - key: api_key
            output_name: bar_api_key

- run: ...
  env:
    foo: ${{steps.secrets.outputs.bar_api_key}}
- run: ...
  env: ${{fromJSON(steps.secrets.outputs.secrets)}}
```

## Inputs

`secrets` is a YAML string, which is a list of secret settings.

- secret_id: (Required): AWS Secrets Manager's secret id
- version_id: (Optional): AWS Secrets Manager's secret version id
- version_stage: (Optional): AWS Secrets Manager's secret version stage
- output_name: (Optional): The action's output name. If `values` is set, this value is ignored. If `values` isn't set, the default value is same with `secret_id`
- values: The list of secrets. If `values` is set, the secret is treated as a JSON string that is a pairs of secret names and values
- values[].key: The secret key
- values[].output_name: The action's output name. The default value is same with `key`

## Why not `aws-actions/aws-secretsmanager-get-secrets`?

https://github.com/aws-actions/aws-secretsmanager-get-secrets

https://github.com/aws-actions/aws-secretsmanager-get-secrets/issues/14

## LICENSE

[MIT](LICENSE)
