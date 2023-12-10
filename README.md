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
        version_id: 
        version_stage: 
      - secret_arn: arn:aws:secretsmanager:us-east-2:123456789012:secret:test1-a1b2c3
      - secret_id: foo
        values:
          - key: foo
            output_name: foo

- run: ...
  env: ${{steps.secrets.outputs.<secret output name>}}
- run: ...
  env: ${{fromJSON(steps.secrets.outputs.all_secrets)}}
```

## Why not `aws-actions/aws-secretsmanager-get-secrets`?

https://github.com/aws-actions/aws-secretsmanager-get-secrets

https://github.com/aws-actions/aws-secretsmanager-get-secrets/issues/14

## LICENSE

[MIT](LICENSE)
