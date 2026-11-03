//! Parent-owned OFFLINE corpus acceptance, not AI generation evidence.
use moro_ai_bridge::creator_v3::parse_project_v3;
use serde_json::Value;

#[test]
fn parent_corpus_agrees_with_frozen_v3_contract() {
    let corpus: Value = serde_json::from_str(include_str!("../../fixtures/director-v3-parent-corpus.json")).unwrap();
    let cases = corpus["cases"].as_array().unwrap();
    assert_eq!(cases.len(), 16);
    for case in cases {
        let bytes = serde_json::to_vec(&case["project"]).unwrap();
        let result = parse_project_v3(&bytes);
        assert_eq!(result.is_ok(), case["valid"].as_bool().unwrap(), "{}: {:?}", case["name"], result.err());
    }
}

#[test]
fn decoded_duplicates_and_invalid_utf8_remain_rejected() {
    let text = include_str!("../../fixtures/director-v3-advanced.json");
    let duplicate = text.replacen("\"version\": 3", "\"version\": 3,\"ver\\u0073ion\":3", 1);
    assert_ne!(text, duplicate);
    assert!(parse_project_v3(duplicate.as_bytes()).is_err());
    assert!(parse_project_v3(b"\xff").is_err());
}
