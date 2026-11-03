use moro_ai_bridge::provider_director as director;
use moro_ai_bridge::creator_v3::{parse_project_v3,validate_project_v3};
use serde_json::{json,Value};
fn blank()->Value {json!({"version":3,"name":"Local","width":512,"height":512,"fps":60,"durationFrames":120,"layers":[]})}
fn layer()->Value {json!({"id":"hero","name":"Hero","parentId":null,"type":"path","x":256,"y":256,"pivot":[0,0],"scaleX":100,"scaleY":100,"rotation":0,"opacity":100,"skew":0,"skewAxis":0,"tracks":{"x":[],"y":[],"scaleX":[],"scaleY":[],"rotation":[],"opacity":[],"skew":[],"skewAxis":[]},"masks":[],"trim":null,"path":{"closed":true,"vertices":[[-20,-20],[20,-20],[0,20]],"inTangents":[[0,0],[0,0],[0,0]],"outTangents":[[0,0],[0,0],[0,0]]},"fill":"#F0A020","stroke":"#000000","strokeWidth":0,"pathKeys":[]})}
fn art()->Value {let mut p=blank();p["layers"]=json!([layer()]);p}
#[test] fn native_v3_path_morph_mask_trim_and_custom_easing() {
 let mut p=art();let g=p["layers"][0]["path"].clone();
 p["layers"][0]["masks"]=json!([{"name":"cut","mode":"subtract","inverted":false,"opacity":100,"path":g}]);
 p["layers"][0]["pathKeys"]=json!([{"frame":0,"value":g,"easing":{"type":"cubic-bezier","x1":0.2,"y1":0,"x2":0.8,"y2":1}}]);
 p["layers"][0]["trim"]=json!({"start":0,"end":100,"offset":0,"tracks":{"start":[],"end":[{"frame":0,"value":50,"easing":"linear"}],"offset":[]}});
 assert_eq!(validate_project_v3(&p),Ok(()));
 for (pointer,value) in [("/layers/0/pathKeys/0/easing/y2",json!(1.1)),("/layers/0/pathKeys/0/value/closed",json!(false)),("/layers/0/masks/0/mode",json!("intersect")),("/layers/0/trim/tracks/end/0/value",json!(101)),("/layers/0/skew",json!(76)),("/layers/0/scaleY",json!(0))] {let mut bad=p.clone();*bad.pointer_mut(pointer).unwrap()=value;assert!(validate_project_v3(&bad).is_err(),"{pointer}");}
 assert!(parse_project_v3(p.to_string().replacen('{',"{\"version\":3,",1).as_bytes()).is_err());
}
fn proposal(stage:&str)->Value {json!({"version":1,"stage":stage,"summary":"A warm badge","review":{"focalPoint":"Hero","silhouette":"Clear","material":"Paper","choreography":"Hold","limitations":"Human review needed"},"poses":if stage=="style"{json!([{"frame":0,"label":"style"}])}else{json!([{"frame":0,"label":"setup"},{"frame":60,"label":"action"},{"frame":119,"label":"settle"}])},"project":art()})}
fn req(stage:&str,approved:Value)->Value {json!({"provider":"codex","prompt":"  한글 brief  ","consent":true,"stage":stage,"contextConsent":stage!="style","approved":approved})}
#[test] fn style_requires_painted_geometry_not_empty_groups_or_transparent_placeholders() {
 for mode in ["empty","groups","transparent","unpainted"] {let mut p=proposal("style");match mode {
 "empty"=>p["project"]["layers"]=json!([]),
 "groups"=>{let l=p["project"]["layers"][0].as_object_mut().unwrap();for key in ["path","pathKeys","fill","stroke","strokeWidth"]{l.remove(key);}l.insert("type".into(),json!("group"));},
 "transparent"=>p["project"]["layers"][0]["opacity"]=json!(0),
 _=>{p["project"]["layers"][0]["fill"]=Value::Null;p["project"]["layers"][0]["strokeWidth"]=json!(0);}}
 assert_eq!(director::validate_proposal(&p,"style"),Err("empty_style"),"{mode}");
 }
 assert_eq!(validate_project_v3(&blank()),Ok(()));
}
#[test] fn director_exact_request_and_stage_envelope_consent() {
 for stage in ["style","poses","motion"] {let prior=match stage{"poses"=>proposal("style"),"motion"=>proposal("poses"),_=>Value::Null};let body=req(stage,prior);let r=director::request(body.to_string().as_bytes()).unwrap();assert_eq!(r.prompt,"한글 brief");assert_eq!(director::validate_proposal(&proposal(stage),stage),Ok(()));
  for (field,val) in [("consent",json!(false)),("stage",json!("other")),("contextConsent",json!(stage=="style")),("approved",proposal(stage))] {let mut bad=body.clone();bad[field]=val;assert!(director::request(bad.to_string().as_bytes()).is_err(),"{stage}:{field}");}
  let duplicate=body.to_string().replacen('{',"{\"consent\":true,",1);assert!(director::request(duplicate.as_bytes()).is_err());
 }
 let mut p=proposal("style");p["project"]["layers"][0]["tracks"]["x"]=json!([{"frame":0,"value":256,"easing":"linear"}]);assert!(director::validate_proposal(&p,"style").is_err());
 let mut p=proposal("style");p["project"]["layers"][0]["pathKeys"]=json!([{"frame":0,"value":layer()["path"],"easing":"linear"}]);assert!(director::validate_proposal(&p,"style").is_err());
 let mut p=proposal("poses");p["poses"][1]["frame"]=json!(0);assert!(director::validate_proposal(&p,"poses").is_err());
 let mut p=proposal("poses");p["review"]["material"]=json!("🙂".repeat(301));assert!(director::validate_proposal(&p,"poses").is_err());
}
#[test] fn approved_design_and_authored_pose_keys_cannot_drift() {
 let r=director::request(req("poses",proposal("style")).to_string().as_bytes()).unwrap();let p=proposal("poses");assert!(director::validate_transition(&p,&r).is_ok());
 for (pointer,val) in [("/project/layers/0/fill",json!("#0000FF")),("/project/layers/0/path/vertices/0/0",json!(-21)),("/project/layers/0/x",json!(257)),("/project/width",json!(1024)),("/project/layers/0/pivot/0",json!(10))] {let mut bad=p.clone();*bad.pointer_mut(pointer).unwrap()=val;assert_eq!(director::validate_transition(&bad,&r),Err("design_drift"),"{pointer}");}
 let mut prior=p;prior["project"]["layers"][0]["tracks"]["x"]=json!([{"frame":60,"value":270,"easing":"linear"}]);prior["project"]["layers"][0]["pathKeys"]=json!([{"frame":60,"value":layer()["path"],"easing":"linear"}]);prior["project"]["layers"][0]["trim"]=json!({"start":0,"end":100,"offset":0,"tracks":{"start":[],"end":[{"frame":60,"value":90,"easing":"linear"}],"offset":[]}});
 let r=director::request(req("motion",prior.clone()).to_string().as_bytes()).unwrap();let mut p=prior;p["stage"]=json!("motion");assert!(director::validate_transition(&p,&r).is_ok());
 for pointer in ["/project/layers/0/tracks/x","/project/layers/0/pathKeys","/project/layers/0/trim/tracks/end"] {let mut bad=p.clone();*bad.pointer_mut(pointer).unwrap()=json!([]);assert_eq!(director::validate_transition(&bad,&r),Err("pose_drift"));}
 let mut bad=p.clone();bad["project"]["layers"][0]["tracks"]["x"][0]["value"]=json!(271);assert_eq!(director::validate_transition(&bad,&r),Err("pose_drift"));
 let mut bad=p.clone();bad["poses"][1]["frame"]=json!(61);assert_eq!(director::validate_transition(&bad,&r),Err("pose_drift"));
 p["project"]["layers"][0]["tracks"]["x"][0]["easing"]=json!("ease-out");p["project"]["layers"][0]["tracks"]["x"].as_array_mut().unwrap().insert(0,json!({"frame":30,"value":260,"easing":"ease-in"}));assert!(director::validate_transition(&p,&r).is_ok());
}
#[test] fn continuity_compares_numeric_values_not_json_number_spelling() {let r=director::request(req("poses",proposal("style")).to_string().as_bytes()).unwrap();let mut p=proposal("poses");p["project"]["width"]=json!(512.0);p["project"]["layers"][0]["x"]=json!(256.0);assert_eq!(director::validate_transition(&p,&r),Ok(()));}
#[test] fn json_integer_valued_floats_match_v3_number_semantics() {let mut p=proposal("style");p["version"]=json!(1.0);p["poses"][0]["frame"]=json!(0.0);assert_eq!(director::validate_proposal(&p,"style"),Ok(()));}
#[test] fn core_owned_v3_corpus_agrees_with_native_validator() {let corpus:Value=serde_json::from_str(include_str!("../../fixtures/creator-v3-corpus.json")).unwrap();for c in corpus["cases"].as_array().unwrap(){let text=c["text"].as_str().map(str::to_owned).unwrap_or_else(||c["project"].to_string());assert_eq!(parse_project_v3(text.as_bytes()).is_ok(),c["valid"].as_bool().unwrap(),"{}",c["id"]);}}
#[test] fn blank_v3_accepts_without_migrating_v2() {
 let p=blank(); assert_eq!(parse_project_v3(p.to_string().as_bytes()),Ok(p.clone()));
 let mut p=p;p["version"]=json!(2);assert!(validate_project_v3(&p).is_err());
}
