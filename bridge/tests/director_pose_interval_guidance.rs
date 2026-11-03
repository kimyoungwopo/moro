use moro_ai_bridge::provider_director::{Request,build_prompt};
use serde_json::Value;
#[test]
fn director_prompt_locks_intervals_containing_accepted_interpolated_poses(){
 let r=Request{provider:"claude".into(),prompt:"A safe success animation".into(),consent:true,stage:"style".into(),approved:Value::Null,context_consent:false};
 let prompt=build_prompt(&r).unwrap();
 assert!(prompt.contains("LOCKED POSE INTERVALS"),"Missing actual planner-input invariant");
 assert!(prompt.contains("including its outgoing easing"));
 assert!(prompt.contains("Keeping the approved animation unchanged is valid"));
}
