pub mod auth;
pub mod creator_v2;
pub mod creator_v3;
pub mod provider;
pub mod claude_protocol;
pub mod provider_v2;
pub mod provider_director;
pub mod harness_native;
pub mod harness;
pub mod jobs;
use serde_json::Value;
pub const MAX_CONTEXT: usize = 65536;
pub const MAX_REQUEST: usize = 131072;
/// Context uses the existing exact project contract, including all five track arrays.
pub fn validate_context(project: &Value) -> Result<(), &'static str> {
    if serde_json::to_vec(project).map_err(|_| "invalid_context")?.len() > MAX_CONTEXT {
        return Err("context_too_large");
    }
    validate_project(project).map_err(|_| "invalid_context")
}
pub const MAX_STDOUT: usize = 2 * 1024 * 1024;
pub const MAX_STDERR: usize = 64 * 1024;
const PROPS: [&str; 5] = ["x", "y", "scale", "rotation", "opacity"];
fn object<'a>(v: &'a Value, keys: &[&str]) -> Result<&'a serde_json::Map<String, Value>, &'static str> {
    let o = v.as_object().ok_or("invalid_project")?;
    if o.len()!=keys.len() || keys.iter().any(|k| !o.contains_key(*k)) { return Err("invalid_project"); }
    Ok(o)
}
fn text(v: &Value) -> bool { v.as_str().is_some_and(|s| !s.trim().is_empty() && s.encode_utf16().count()<=200 && !s.chars().any(char::is_control)) }
fn number(v: &Value, min: f64, max: f64, integer: bool) -> bool { v.as_f64().is_some_and(|n| n.is_finite() && n>=min && n<=max && (!integer || n.fract()==0.0)) }
fn range(prop: &str) -> (f64,f64) { match prop {"scale"=>(1.,1000.),"rotation"=>(-3600.,3600.),"opacity"=>(0.,100.),_=>(-8192.,8192.)} }
pub fn validate_project(p: &Value) -> Result<(), &'static str> {
    object(p,&["version","name","width","height","fps","durationFrames","layers"])?;
    if p["version"]!=1 || !text(&p["name"]) || !number(&p["width"],16.,4096.,true) || !number(&p["height"],16.,4096.,true) || !number(&p["fps"],1.,120.,true) || !number(&p["durationFrames"],2.,3600.,true) { return Err("invalid_project"); }
    let layers=p["layers"].as_array().filter(|l| l.len()<=20).ok_or("invalid_project")?;
    let mut ids=std::collections::HashSet::new();
    for l in layers {
        let mut layer_keys=vec!["id","name","type","x","y","width","height","fill","stroke","strokeWidth","rotation","opacity","scale","tracks"];
        if l.get("cornerRadius").is_some() { layer_keys.push("cornerRadius"); }
        object(l,&layer_keys)?;
        if !text(&l["id"]) || !text(&l["name"]) || !ids.insert(l["id"].as_str().unwrap()) || !matches!(l["type"].as_str(),Some("rect"|"ellipse")) { return Err("invalid_project"); }
        for prop in PROPS { let (lo,hi)=range(prop); if !number(&l[prop],lo,hi,false) { return Err("invalid_project"); } }
        for prop in ["width","height"] { if !number(&l[prop],1.,4096.,false) { return Err("invalid_project"); } }
        if let Some(radius)=l.get("cornerRadius").filter(|r| !r.is_null()) {
            let max=if l["type"]=="rect" { l["width"].as_f64().unwrap().min(l["height"].as_f64().unwrap())/2. } else { 0. };
            if !number(radius,0.,max,false) { return Err("invalid_project"); }
        }
        if !number(&l["strokeWidth"],0.,100.,false) { return Err("invalid_project"); }
        for prop in ["fill","stroke"] { if !l[prop].as_str().is_some_and(|s|s.len()==7 && s.starts_with('#') && s.as_bytes()[1..].iter().all(u8::is_ascii_hexdigit)) { return Err("invalid_project"); } }
        object(&l["tracks"],&PROPS)?;
        for prop in PROPS {
            let keys=l["tracks"][prop].as_array().filter(|k|k.len()<=100).ok_or("invalid_project")?;
            let mut previous=-1.; let (lo,hi)=range(prop);
            for k in keys {
                object(k,&["frame","value","easing"])?;
                if !number(&k["frame"],0.,p["durationFrames"].as_f64().unwrap()-1.,true) || !number(&k["value"],lo,hi,false) || !matches!(k["easing"].as_str(),Some("linear"|"ease-in"|"ease-out"|"ease-in-out")) { return Err("invalid_project"); }
                let frame=k["frame"].as_f64().unwrap(); if frame<=previous {return Err("invalid_project");} previous=frame;
            }
        }
    }
    if serde_json::to_vec(p).map_err(|_|"invalid_project")?.len()>MAX_STDOUT {return Err("invalid_project");}
    Ok(())
}
