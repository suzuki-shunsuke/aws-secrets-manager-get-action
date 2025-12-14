# aws-secrets-manager-get-action

[![DeepWiki](https://img.shields.io/badge/DeepWiki-suzuki--shunsuke%2Faws--secrets--manager--get--action-blue.svg?logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAyCAYAAAAnWDnqAAAAAXNSR0IArs4c6QAAA05JREFUaEPtmUtyEzEQhtWTQyQLHNak2AB7ZnyXZMEjXMGeK/AIi+QuHrMnbChYY7MIh8g01fJoopFb0uhhEqqcbWTp06/uv1saEDv4O3n3dV60RfP947Mm9/SQc0ICFQgzfc4CYZoTPAswgSJCCUJUnAAoRHOAUOcATwbmVLWdGoH//PB8mnKqScAhsD0kYP3j/Yt5LPQe2KvcXmGvRHcDnpxfL2zOYJ1mFwrryWTz0advv1Ut4CJgf5uhDuDj5eUcAUoahrdY/56ebRWeraTjMt/00Sh3UDtjgHtQNHwcRGOC98BJEAEymycmYcWwOprTgcB6VZ5JK5TAJ+fXGLBm3FDAmn6oPPjR4rKCAoJCal2eAiQp2x0vxTPB3ALO2CRkwmDy5WohzBDwSEFKRwPbknEggCPB/imwrycgxX2NzoMCHhPkDwqYMr9tRcP5qNrMZHkVnOjRMWwLCcr8ohBVb1OMjxLwGCvjTikrsBOiA6fNyCrm8V1rP93iVPpwaE+gO0SsWmPiXB+jikdf6SizrT5qKasx5j8ABbHpFTx+vFXp9EnYQmLx02h1QTTrl6eDqxLnGjporxl3NL3agEvXdT0WmEost648sQOYAeJS9Q7bfUVoMGnjo4AZdUMQku50McDcMWcBPvr0SzbTAFDfvJqwLzgxwATnCgnp4wDl6Aa+Ax283gghmj+vj7feE2KBBRMW3FzOpLOADl0Isb5587h/U4gGvkt5v60Z1VLG8BhYjbzRwyQZemwAd6cCR5/XFWLYZRIMpX39AR0tjaGGiGzLVyhse5C9RKC6ai42ppWPKiBagOvaYk8lO7DajerabOZP46Lby5wKjw1HCRx7p9sVMOWGzb/vA1hwiWc6jm3MvQDTogQkiqIhJV0nBQBTU+3okKCFDy9WwferkHjtxib7t3xIUQtHxnIwtx4mpg26/HfwVNVDb4oI9RHmx5WGelRVlrtiw43zboCLaxv46AZeB3IlTkwouebTr1y2NjSpHz68WNFjHvupy3q8TFn3Hos2IAk4Ju5dCo8B3wP7VPr/FGaKiG+T+v+TQqIrOqMTL1VdWV1DdmcbO8KXBz6esmYWYKPwDL5b5FA1a0hwapHiom0r/cKaoqr+27/XcrS5UwSMbQAAAABJRU5ErkJggg==)](https://deepwiki.com/suzuki-shunsuke/aws-secrets-manager-get-action)

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
