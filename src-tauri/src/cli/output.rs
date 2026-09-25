use serde_json::json;

use super::command::CommandOutput;
use super::error::CliError;

const SCHEMA_VERSION: u32 = 1;

/// Envelope fields shared by every successful `--json` response (design doc §5).
pub(crate) struct Envelope {
    pub(crate) profile: String,
    pub(crate) db_path: String,
    pub(crate) route: &'static str,
}

pub(crate) fn print_success(envelope: &Envelope, output: CommandOutput, as_json: bool) {
    if as_json {
        let payload = json!({
            "schema_version": SCHEMA_VERSION,
            "profile": envelope.profile,
            "db_path": envelope.db_path,
            "route": envelope.route,
            "data": output.json_data,
        });
        println!("{payload}");
    } else {
        println!("{}", output.human);
    }
}

pub(crate) fn print_error(error: &CliError, as_json: bool) {
    if as_json {
        let payload = json!({
            "schema_version": SCHEMA_VERSION,
            "error": {
                "code": error.code_str(),
                "message": error.message,
            },
        });
        println!("{payload}");
    } else {
        eprintln!("error: {}", error.message);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    #[test]
    fn success_envelope_has_the_contracted_keys_and_types() {
        let envelope = Envelope {
            profile: "prod".to_string(),
            db_path: "~/Library/Application Support/example/ultra-rss-reader.db".to_string(),
            route: "read_only",
        };
        let output = CommandOutput {
            human: "ok".to_string(),
            json_data: json!({ "foo": "bar" }),
            exit_code: None,
        };

        let payload = json!({
            "schema_version": SCHEMA_VERSION,
            "profile": envelope.profile,
            "db_path": envelope.db_path,
            "route": envelope.route,
            "data": output.json_data,
        });

        assert_eq!(payload["schema_version"], Value::from(1));
        assert!(payload["profile"].is_string());
        assert!(payload["db_path"].is_string());
        assert!(payload["route"].is_string());
        assert!(payload["data"].is_object());
        assert!(payload.get("error").is_none());
    }

    #[test]
    fn error_envelope_has_the_contracted_keys_and_types() {
        let error = CliError::failed("boom");

        let payload = json!({
            "schema_version": SCHEMA_VERSION,
            "error": {
                "code": error.code_str(),
                "message": error.message,
            },
        });

        assert_eq!(payload["schema_version"], Value::from(1));
        assert!(payload["error"]["code"].is_string());
        assert!(payload["error"]["message"].is_string());
        assert!(payload.get("data").is_none());
        assert!(payload.get("profile").is_none());
    }
}
