import { parseSecretStringJSON, parseInputSecretValue, parseInputSecret, parseInputSecrets } from "./run";

test("parseSecretStringJSON: normal", () => {
    const result = parseSecretStringJSON('{"key1": "value1", "key2": "value2"}');
    expect(result).toEqual(new Map<string, string>([
        ["key1", "value1"],
        ["key2", "value2"],
    ]));
});

test("parseInputSecretValue: normal", () => {
    const result = parseInputSecretValue({
        key: "foo",
        output_name: "yoo_foo",
    });
    expect(result).toEqual({
        key: "foo",
        output_name: "yoo_foo",
    });
});

test("parseInputSecretValue: the default output_name is key", () => {
    const result = parseInputSecretValue({
        key: "foo",
    });
    expect(result).toEqual({
        key: "foo",
        output_name: "foo",
    });
});

test("parseInputSecret: normal", () => {
    const result = parseInputSecret({
        secret_id: "foo",
        output_name: "yoo_foo",
    });
    expect(result).toEqual({
        secret_id: "foo",
        output_name: "yoo_foo",
        values: [],
    });
});

test("parseInputSecret: values", () => {
    const result = parseInputSecret({
        secret_id: "foo",
        values: [
            {
                key: "app_id",
            },
            {
                key: "private_key",
            },
        ],
    });
    expect(result).toEqual({
        secret_id: "foo",
        output_name: "",
        values: [
            {
                key: "app_id",
                output_name: "app_id",
            },
            {
                key: "private_key",
                output_name: "private_key",
            },
        ],
    });
});

test("parseInputSecrets: normal", () => {
    const result = parseInputSecrets(`
- secret_id: app
  values:
    - key: app_id
    - key: private_key
- secret_id: github_token
  output_name: token
`);
    expect(result).toEqual([
        {
            secret_id: "app",
            output_name: "",
            values: [
                {
                    key: "app_id",
                    output_name: "app_id",
                },
                {
                    key: "private_key",
                    output_name: "private_key",
                },
            ],
        },
        {
            secret_id: "github_token",
            output_name: "token",
            values: [],
        },
    ]);
});
