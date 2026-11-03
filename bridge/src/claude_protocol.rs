//! Claude-only transport projection. Native validators remain authoritative.
use serde_json::Value;
pub const HELP_FLAGS: &[&str] = &["--tools","--strict-mcp-config","--setting-sources","--settings","--disable-slash-commands","--no-chrome","--permission-mode","--no-session-persistence","--json-schema","--output-format","--effort","--verbose","--include-partial-messages"];
pub const FORMATTER_RULE: &str = "Use only the internal StructuredOutput JSON-return formatter to deliver the schema-matching data. StructuredOutput is not a host tool. Never invoke executable tools, access files, run code, hooks, MCP, plugins or local instructions.";
/// Translate schema keywords, never instance properties, enum/const or defaults.
pub fn schema(source: &str) -> String {
    fn visit(v: &mut Value) {
        let Some(o) = v.as_object_mut() else { return };
        if o.contains_key("$schema") { o.insert("$schema".into(), "http://json-schema.org/draft-07/schema#".into()); }
        if let Some(defs) = o.remove("$defs") { o.insert("definitions".into(), defs); }
        if let Some(Value::String(r)) = o.get_mut("$ref") { if r.starts_with("#/") { *r = r.replace("/$defs/", "/definitions/"); } }
        if let Some(prefix) = o.remove("prefixItems") {
            let tail = o.remove("items").unwrap_or(Value::Bool(true));
            o.insert("items".into(), prefix); o.insert("additionalItems".into(), tail);
        }
        for key in ["properties","patternProperties","definitions","dependentSchemas"] {
            if let Some(Value::Object(map)) = o.get_mut(key) { for child in map.values_mut() { visit(child); } }
        }
        for key in ["items","additionalItems","additionalProperties","contains","propertyNames","not","if","then","else"] {
            if let Some(child) = o.get_mut(key) { if let Value::Array(a) = child { for c in a { visit(c); } } else { visit(child); } }
        }
        for key in ["allOf","anyOf","oneOf"] { if let Some(Value::Array(a)) = o.get_mut(key) { for child in a { visit(child); } } }
    }
    let mut v: Value = serde_json::from_str(source).expect("trusted provider schema");
    visit(&mut v); v["$schema"] = "http://json-schema.org/draft-07/schema#".into(); v.to_string()
}

pub const MAX_LINE: usize = crate::MAX_STDOUT + 65536;
pub const MAX_STREAM: usize = 16 * 1024 * 1024;
/// Only a partial protocol line and the normalized result survive each event.
#[derive(Default)]
pub struct Stream {
    line: Vec<u8>, total: usize, result: Option<Vec<u8>>, initialized: bool,
    blocks: std::collections::HashMap<u64, &'static str>,
    formatters: std::collections::HashMap<String, u8>,
    phase: Option<&'static str>,
    failed: Option<&'static str>,
}
impl Stream {
    pub fn push(&mut self, bytes: &[u8]) -> Result<(), &'static str> {
        if let Some(e) = self.failed { return Err(e); }
        let result = self.push_inner(bytes);
        if let Err(e) = result { self.failed = Some(e); self.line.fill(0); self.line.clear(); self.result = None; }
        result
    }
    fn push_inner(&mut self, bytes: &[u8]) -> Result<(), &'static str> {
        self.total = self.total.checked_add(bytes.len()).ok_or("output_limit")?;
        if self.total > MAX_STREAM { return Err("output_limit"); }
        for chunk in bytes.split_inclusive(|b| *b == b'\n') {
            if self.line.len() + chunk.len() > MAX_LINE { return Err("output_limit"); }
            self.line.extend_from_slice(chunk);
            if chunk.last() == Some(&b'\n') { self.parse_line()?; }
        }
        Ok(())
    }
    fn parse_line(&mut self) -> Result<(), &'static str> {
        let v = crate::creator_v2::parse_json_strict(&self.line).map_err(|_| "invalid_output")?;
        self.line.fill(0); self.line.clear();
        // Typed error flags dominate even when a later result claims success.
        if v["is_error"] == true && v["type"] != "result" { return Err("provider_failed"); }
        match v["type"].as_str() {
            Some("system") if v["subtype"] == "init" => {
                if self.initialized || self.result.is_some() { return Err("unsafe_output"); }
                let tools = v["tools"].as_array().ok_or("invalid_provider_schema")?;
                if !tools.iter().any(|t|t == "StructuredOutput") { return Err("invalid_provider_schema"); }
                if tools.len() != 1 || !v["mcp_servers"].as_array().is_some_and(Vec::is_empty) || v["permissionMode"] != "dontAsk" { return Err("unsafe_output"); }
                self.initialized = true;
            },
            Some("system") if v["subtype"] == "api_retry" => {
                if !self.initialized || self.result.is_some() { return Err("unsafe_output"); }
                self.phase = None;
            },
            Some("rate_limit_event") => match v["rate_limit_info"]["status"].as_str() {
                Some("allowed" | "allowed_warning") => {},
                Some("rejected") => return Err("rate_limit"),
                _ => return Err("unsafe_output")
            },
            Some("assistant" | "user" | "stream_event") => {
                if !self.initialized || self.result.is_some() || !v["parent_tool_use_id"].is_null() { return Err("unsafe_output"); }
                match v["type"].as_str().unwrap() {
                    "assistant" => {
                        if !v["error"].is_null() { return Err(if v["error"] == "authentication_failed" {"needs_login"} else {"provider_failed"}); }
                        for block in v["message"]["content"].as_array().ok_or("unsafe_output")? { self.content(block, false)?; }
                    },
                    "user" => {
                        for block in v["message"]["content"].as_array().filter(|a|!a.is_empty()).ok_or("unsafe_output")? {
                            if block["type"] != "tool_result" { return Err("unsafe_output"); }
                            let id = block["tool_use_id"].as_str().ok_or("unsafe_output")?;
                            let state = self.formatters.get_mut(id).ok_or("unsafe_output")?;
                            if *state & 4 != 0 { return Err("unsafe_output"); }
                            if block["is_error"] == true { return Err("provider_failed"); }
                            if !block["is_error"].is_null() && block["is_error"] != false { return Err("unsafe_output"); }
                            if let Some(content) = block["content"].as_array() { if content.iter().any(|b|b["type"] != "text") { return Err("unsafe_output"); } }
                            else if !block["content"].is_string() { return Err("unsafe_output"); }
                            *state |= 4;
                        }
                        self.phase = None;
                    },
                    _ => self.event(&v["event"])?
                }
            },
            Some("result") => {
                if v["is_error"] == true { return Err(if v["result"].as_str().is_some_and(|s|s.starts_with("Failed to authenticate") && crate::provider::login_error(s.as_bytes())) {"needs_login"} else {"provider_failed"}); }
                if !self.initialized || self.result.is_some() || v["subtype"] != "success" || v["is_error"] != false || !v["permission_denials"].as_array().is_some_and(Vec::is_empty) { return Err("unsafe_output"); }
                let output = v.get("structured_output").filter(|v|v.is_object()).ok_or("invalid_output")?;
                let normalized = serde_json::json!({"type":"result","subtype":"success","is_error":false,"permission_denials":[],"structured_output":output});
                let out = serde_json::to_vec(&normalized).map_err(|_| "invalid_output")?;
                if out.len() > crate::MAX_STDOUT { return Err("output_limit"); }
                self.result = Some(out);
                self.phase = None;
            },
            _ => return Err("unsafe_output")
        }
        Ok(())
    }
    fn content(&mut self, block: &Value, partial: bool) -> Result<&'static str, &'static str> {
        match block["type"].as_str() {
            Some("text") => { self.phase = Some("writing"); Ok("text") },
            Some("thinking" | "redacted_thinking") => { self.phase = Some("thinking"); Ok("thinking") },
            Some("tool_use") if block["name"] == "StructuredOutput" => {
                let id = block["id"].as_str().filter(|s|!s.is_empty() && s.len() <= 256).ok_or("unsafe_output")?;
                if self.formatters.len() >= 64 && !self.formatters.contains_key(id) { return Err("output_limit"); }
                let flag = if partial {1} else {2};
                let state = self.formatters.entry(id.into()).or_default();
                if *state & (flag | 4) != 0 { return Err("unsafe_output"); } *state |= flag;
                self.phase = Some("writing");
                Ok("tool_use")
            },
            _ => Err("unsafe_output")
        }
    }
    fn event(&mut self, e: &Value) -> Result<(), &'static str> {
        match e["type"].as_str() {
            Some("message_start") => { self.phase = None; self.blocks.clear(); if !e["message"]["content"].as_array().is_some_and(Vec::is_empty) { return Err("unsafe_output"); } },
            Some("content_block_start") => {
                let index = e["index"].as_u64().filter(|i|*i < 64).ok_or("unsafe_output")?;
                if self.blocks.contains_key(&index) { return Err("unsafe_output"); }
                let kind = self.content(&e["content_block"], true)?; self.blocks.insert(index, kind);
            },
            Some("content_block_delta") => {
                let delta = &e["delta"];
                match delta["type"].as_str() {
                    Some("thinking_delta" | "signature_delta") => self.phase = Some("thinking"),
                    Some("text_delta") => self.phase = Some("writing"),
                    Some("input_json_delta") if e["index"].as_u64().and_then(|i|self.blocks.get(&i)) == Some(&"tool_use") => self.phase = Some("writing"),
                    _ => return Err("unsafe_output")
                }
            },
            Some("content_block_stop") => { let i=e["index"].as_u64().ok_or("unsafe_output")?; if self.blocks.remove(&i).is_none() { return Err("unsafe_output"); } },
            Some("message_delta") => { if !e["delta"].is_object() || !e["delta"]["type"].is_null() { return Err("unsafe_output"); } },
            Some("message_stop") => self.phase = None,
            _ => return Err("unsafe_output")
        }
        Ok(())
    }
    pub fn finish(mut self) -> Result<Vec<u8>, &'static str> {
        if let Some(e) = self.failed { return Err(e); }
        if !self.line.is_empty() { self.parse_line()?; }
        self.result.ok_or("invalid_output")
    }
    pub fn timeout_code(&self) -> &'static str {
        match self.phase { Some("thinking") => "timeout_thinking", Some("writing") => "timeout_writing", _ => "timeout_waiting" }
    }
}
