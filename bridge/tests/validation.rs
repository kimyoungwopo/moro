use moro_ai_bridge::validate_project;
use serde_json::{json, Value};
fn project() -> Value { json!({"version":1,"name":"Proposal","width":512,"height":512,"fps":60,"durationFrames":120,"layers":[]}) }
#[test] fn schema_explains_percent_units_for_static_and_animated_transforms() {
 let schema:Value=serde_json::from_str(moro_ai_bridge::provider::SCHEMA).unwrap();
 for pointer in ["/$defs/layer/properties/scale/description","/$defs/layer/properties/opacity/description","/$defs/scaleKey/properties/value/description","/$defs/opacityKey/properties/value/description"] {
  let description=schema.pointer(pointer).and_then(Value::as_str).unwrap_or("");
  assert!(description.contains("100")&&description.contains("percent"),"missing percent units at {pointer}");
 }
}
#[test] fn rejects_unknown_root_fields() { let mut p=project(); p["script"]=json!("do not execute"); assert!(validate_project(&p).is_err(), "unknown executable-bearing field must fail"); }
#[test] fn accepts_valid_blank_project() { assert!(validate_project(&project()).is_ok()); }
fn layer() -> Value { json!({"id":"a","name":"Ellipse","type":"ellipse","x":0,"y":0,"width":100,"height":100,"fill":"#abcdef","stroke":"#123456","strokeWidth":0,"rotation":0,"opacity":100,"scale":100,"tracks":{"x":[],"y":[],"scale":[],"rotation":[],"opacity":[]}}) }
#[test] fn schema_requires_nullable_static_corner_radius_with_dynamic_bound_guidance() {
 let schema:Value=serde_json::from_str(moro_ai_bridge::provider::SCHEMA).unwrap();
 let definition=&schema["$defs"]["layer"];
 assert!(definition["required"].as_array().unwrap().contains(&json!("cornerRadius")), "strict AI proposals must explicitly supply cornerRadius");
 let radius=&definition["properties"]["cornerRadius"];
 assert_eq!(radius["type"],json!(["number","null"]));
 assert_eq!(radius["minimum"],json!(0));
 assert_eq!(radius["maximum"],json!(2048));
 let description=radius["description"].as_str().unwrap();
 for word in ["static","min(width,height)/2","ellipse","null"] { assert!(description.contains(word),"missing radius guidance: {word}"); }
 assert_eq!(definition["additionalProperties"],json!(false));
 // Every strict-provider object retains required == declared, including all five tracks.
 for definition in schema["$defs"].as_object().unwrap().values().chain(std::iter::once(&schema)) {
  if definition["type"]=="object" {
   let properties=definition["properties"].as_object().unwrap();
   let required=definition["required"].as_array().unwrap();
   assert_eq!(properties.len(),required.len());
   for key in properties.keys() { assert!(required.contains(&json!(key))); }
   assert_eq!(definition["additionalProperties"],json!(false));
  }
 }
 assert_eq!(schema["$defs"]["tracks"]["required"],json!(["x","y","scale","rotation","opacity"]));
}
#[test] fn accepts_legacy_and_nullable_bounded_static_radius_without_mutating_source() {
 for shape in ["rect","ellipse"] {
  let mut p=project(); let mut l=layer(); l["type"]=json!(shape); p["layers"]=json!([l]);
  let original=serde_json::to_string(&p).unwrap();
  assert!(validate_project(&p).is_ok());
  assert_eq!(serde_json::to_string(&p).unwrap(),original);
  assert!(!p["layers"][0].as_object().unwrap().contains_key("cornerRadius"));
  let radii=if shape=="rect" {vec![Value::Null,json!(0),json!(0.25),json!(50)]} else {vec![Value::Null,json!(0)]};
  for radius in radii {
   let mut rounded=p.clone(); rounded["layers"][0]["cornerRadius"]=radius;
   let before=serde_json::to_string(&rounded).unwrap();
   assert!(validate_project(&rounded).is_ok(),"{shape} radius {}",rounded["layers"][0]["cornerRadius"]);
   assert_eq!(serde_json::to_string(&rounded).unwrap(),before);
  }
 }
 let mut narrow=project(); let mut l=layer(); l["type"]=json!("rect"); l["width"]=json!(9); l["cornerRadius"]=json!(4.5); narrow["layers"]=json!([l]);
 assert!(validate_project(&narrow).is_ok());
 narrow["layers"][0]["cornerRadius"]=json!(4.501); assert!(validate_project(&narrow).is_err());
}
#[test] fn radius_rejects_invalid_geometry_unknown_fields_missing_fields_and_animated_radius() {
 let mut p=project(); let mut l=layer(); l["type"]=json!("rect"); l["cornerRadius"]=json!(25); p["layers"]=json!([l]);
 assert!(validate_project(&p).is_ok(),"valid rounded rectangle is the control");
 for radius in [json!(-0.01),json!(50.001),json!("5"),json!(true),json!({}),json!([])] {
  let mut bad=p.clone(); bad["layers"][0]["cornerRadius"]=radius; assert!(validate_project(&bad).is_err());
 }
 let mut ellipse=p.clone(); ellipse["layers"][0]["type"]=json!("ellipse"); ellipse["layers"][0]["cornerRadius"]=json!(0.001); assert!(validate_project(&ellipse).is_err());
 let mut extra=p.clone(); extra["layers"][0]["script"]=json!("evil"); assert!(validate_project(&extra).is_err());
 // The legacy-size object cannot hide an unknown field by omitting a required field.
 let mut replaced=p.clone(); replaced["layers"][0].as_object_mut().unwrap().remove("cornerRadius"); replaced["layers"][0].as_object_mut().unwrap().remove("fill"); replaced["layers"][0]["script"]=json!("evil"); assert!(validate_project(&replaced).is_err());
 for key in ["id","name","type","x","y","width","height","fill","stroke","strokeWidth","rotation","opacity","scale","tracks"] {
  let mut missing=p.clone(); missing["layers"][0].as_object_mut().unwrap().remove(key); assert!(validate_project(&missing).is_err(),"missing {key}");
 }
 for key in ["x","y","scale","rotation","opacity"] {
  let mut missing=p.clone(); missing["layers"][0]["tracks"].as_object_mut().unwrap().remove(key); assert!(validate_project(&missing).is_err(),"missing track {key}");
 }
 let mut animated=p.clone(); animated["layers"][0]["tracks"]["cornerRadius"]=json!([]); assert!(validate_project(&animated).is_err());
 // serde_json cannot represent NaN/Infinity; overflow syntax must fail before validation.
 assert!(serde_json::from_str::<Value>("1e400").is_err());
}
#[test] fn enforces_complete_strict_core_bounds_and_tracks() {
 let mut p=project(); p["layers"]=json!([layer()]); assert!(validate_project(&p).is_ok());
 for (key,value) in [("width",json!(15)),("height",json!(4097)),("fps",json!(1.5)),("durationFrames",json!(1)),("name",json!("\u{007f}")),("version",json!(2))] {
   if key=="layers" {continue;} let mut bad=p.clone(); bad[key]=value; assert!(validate_project(&bad).is_err(),"root {key}");
 }
 let mut bad=p.clone(); bad["layers"][0]["tracks"].as_object_mut().unwrap().remove("x"); assert!(validate_project(&bad).is_err());
 for (key,value) in [("scale",json!(0)),("x",json!(8193)),("opacity",json!(-1)),("fill",json!("red")),("type",json!("text")),("extra",json!(true)),("width",json!(0))] { let mut bad=p.clone(); bad["layers"][0][key]=value; assert!(validate_project(&bad).is_err(),"layer {key}"); }
 for keys in [json!([{"frame":120,"value":0,"easing":"linear"}]),json!([{"frame":0,"value":9000,"easing":"linear"}]),json!([{"frame":0,"value":0,"easing":"evil"}]),json!([{"frame":1,"value":0,"easing":"linear"},{"frame":1,"value":0,"easing":"linear"}])] { let mut bad=p.clone(); bad["layers"][0]["tracks"]["x"]=keys; assert!(validate_project(&bad).is_err()); }
 let mut bad=p.clone(); bad["layers"]=json!([layer(),layer()]); assert!(validate_project(&bad).is_err());
 let mut bad=p.clone(); bad["layers"]=Value::Array((0..21).map(|i|{let mut l=layer();l["id"]=json!(i.to_string());l}).collect());assert!(validate_project(&bad).is_err());
 let mut bad=p.clone(); bad.as_object_mut().unwrap().remove("width");assert!(validate_project(&bad).is_err());
}
