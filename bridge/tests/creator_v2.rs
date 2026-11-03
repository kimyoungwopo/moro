use moro_ai_bridge::creator_v2::{validate_project_v2, parse_project_v2, MAX_PROJECT_BYTES};
use serde_json::{Value, json};

fn project() -> Value {
    json!({"version":2,"name":"Native rig","width":512,"height":512,"fps":60,"durationFrames":120,"layers":[]})
}

fn corpus() -> Value {
    serde_json::from_str(include_str!("../../fixtures/creator-v2-corpus.json")).unwrap()
}

#[test]
fn shared_json_value_corpus() {
    let c = corpus();
    let cases = c["cases"].as_array().unwrap();
    assert_eq!(cases.len(), 13);
    for case in cases.iter().filter(|c| c.get("project").is_some()) {
        assert_eq!(validate_project_v2(&case["project"]).is_ok(), case["valid"].as_bool().unwrap(), "{}", case["id"]);
    }
}

#[test]
fn strict_bytes_match_all_shared_cases() {
    for case in corpus()["cases"].as_array().unwrap() {
        let bytes = if let Some(s) = case["text"].as_str() { s.as_bytes().to_vec() } else { serde_json::to_vec(&case["project"]).unwrap() };
        assert_eq!(parse_project_v2(&bytes).is_ok(), case["valid"].as_bool().unwrap(), "{}", case["id"]);
    }
}

#[test]
fn strict_bytes_reject_duplicates_escapes_depth_size_and_non_json() {
    let original = serde_json::to_string(&project()).unwrap();
    for bad in [
        original.replacen("{", "{\"version\":2,", 1),
        original.replacen("{", "{\"vers\\u0069on\":2,", 1),
        original.replacen("[]", "[{\"x\":1,\"x\":2}]", 1),
        format!("{original} null"),
        original.replace("512", "1e999"),
        original.replace("512", "NaN"),
    ] { assert!(parse_project_v2(bad.as_bytes()).is_err(), "{bad}"); }
    assert!(parse_project_v2(b"\xff").is_err());
    assert!(parse_project_v2(&vec![b' '; MAX_PROJECT_BYTES+1]).is_err());
    let deep = format!("{}0{}", "[".repeat(33), "]".repeat(33));
    assert_eq!(parse_project_v2(deep.as_bytes()).unwrap_err(), "invalid_json");
    let at_limit = format!("{}0{}", "[".repeat(32), "]".repeat(32));
    assert_eq!(parse_project_v2(at_limit.as_bytes()).unwrap_err(), "invalid_object");
    let nested_dup = original.replace("[]", "[{\"tracks\":{\"x\":[],\"\\u0078\":[]}}]");
    assert_eq!(parse_project_v2(nested_dup.as_bytes()).unwrap_err(), "invalid_json");
    let mut padded = original.into_bytes();
    padded.resize(MAX_PROJECT_BYTES, b' ');
    assert!(parse_project_v2(&padded).is_ok());
    padded.push(b' ');
    assert!(parse_project_v2(&padded).is_err());
}

fn primitive() -> Value {
    json!({"id":"shape","name":"shape","type":"rect","parentId":null,"x":0,"y":0,"pivot":[0,0],"scale":100,"rotation":0,"opacity":100,"tracks":{"x":[],"y":[],"scale":[],"rotation":[],"opacity":[]},"width":16,"height":16,"cornerRadius":null,"fill":"#123aBC","stroke":"#000000","strokeWidth":0})
}
fn group(id: usize, parent: Option<usize>) -> Value {
    let mut g = primitive(); let o = g.as_object_mut().unwrap();
    for k in ["width","height","cornerRadius","fill","stroke","strokeWidth"] { o.remove(k); }
    g["id"] = json!(format!("g{id}")); g["type"] = json!("group");
    g["parentId"] = parent.map(|i| json!(format!("g{i}"))).unwrap_or(Value::Null); g
}
fn with_layers(layers: Vec<Value>) -> Value { let mut p = project(); p["layers"] = json!(layers); p }
fn key(frame: usize, value: f64) -> Value { json!({"frame":frame,"value":value,"easing":"linear"}) }

#[test]
fn header_and_utf16_text_boundaries() {
    for (field, lo, hi) in [("width",16.,4096.),("height",16.,4096.),("fps",1.,120.),("durationFrames",2.,3600.)] {
        for value in [lo,hi] { let mut p = project(); p[field]=json!(value); assert!(validate_project_v2(&p).is_ok()); }
        for value in [json!(lo-1.), json!(hi+1.), json!(lo+0.5), Value::Null, json!("20")] { let mut p = project(); p[field]=value; assert!(validate_project_v2(&p).is_err(), "{field}: {p}"); }
    }
    for good in ["a".repeat(200), "😀".repeat(100), "\u{feff}a\u{feff}".to_owned()] {
        let mut p = project(); p["name"]=json!(good); assert!(validate_project_v2(&p).is_ok());
    }
    for bad in ["a".repeat(201), "😀".repeat(101), "\u{feff}".to_owned(), " ".to_owned(), String::new()] {
        let mut p = project(); p["name"]=json!(bad); assert!(validate_project_v2(&p).is_err());
    }
    for code in (0..=31).chain(127..=159) { let mut p=project(); p["name"]=json!(format!("a{}b", char::from_u32(code).unwrap())); assert!(validate_project_v2(&p).is_err()); }
    let mut p = project(); p["version"]=json!(2.0); assert!(validate_project_v2(&p).is_ok());
}

#[test]
fn exact_required_fields_at_every_level() {
    let p = with_layers(vec![primitive()]);
    for field in p.as_object().unwrap().keys() { let mut bad=p.clone(); bad.as_object_mut().unwrap().remove(field); assert!(validate_project_v2(&bad).is_err()); }
    for field in p["layers"][0].as_object().unwrap().keys() { let mut bad=p.clone(); bad["layers"][0].as_object_mut().unwrap().remove(field); assert!(validate_project_v2(&bad).is_err(), "{field}"); }
    for prop in ["x","y","scale","rotation","opacity"] { let mut bad=p.clone(); bad["layers"][0]["tracks"].as_object_mut().unwrap().remove(prop); assert!(validate_project_v2(&bad).is_err()); }
    for pointer in ["", "/layers/0", "/layers/0/tracks"] { let mut bad=p.clone(); bad.pointer_mut(pointer).unwrap().as_object_mut().unwrap().insert("extra".to_owned(),Value::Null); assert!(validate_project_v2(&bad).is_err()); }
}

#[test]
fn transform_and_key_range_boundaries() {
    for (prop, lo, hi) in [("x",-8192.,8192.),("y",-8192.,8192.),("scale",1.,1000.),("rotation",-3600.,3600.),("opacity",0.,100.)] {
        for value in [lo,hi] {
            let mut l=primitive(); l[prop]=json!(value); l["tracks"][prop]=json!([key(0,value)]);
            assert!(validate_project_v2(&with_layers(vec![l])).is_ok(), "{prop}:{value}");
        }
        for value in [json!(lo-0.1),json!(hi+0.1),json!("100"),Value::Null] {
            let mut l=primitive(); l[prop]=value.clone(); assert!(validate_project_v2(&with_layers(vec![l])).is_err());
            let mut l=primitive(); l["tracks"][prop]=json!([{"frame":0,"value":value,"easing":"linear"}]); assert!(validate_project_v2(&with_layers(vec![l])).is_err());
        }
    }
    for pivot in [json!([-4096,4096]),json!([0,0])] { let mut l=primitive(); l["pivot"]=pivot; assert!(validate_project_v2(&with_layers(vec![l])).is_ok()); }
    for pivot in [json!([0]),json!([0,0,0]),json!([4096.01,0]),json!([null,0])] { let mut l=primitive(); l["pivot"]=pivot; assert!(validate_project_v2(&with_layers(vec![l])).is_err()); }
    for easing in ["linear","ease-in","ease-out","ease-in-out"] { let mut l=primitive(); l["tracks"]["x"]=json!([{"frame":119,"value":0,"easing":easing}]); assert!(validate_project_v2(&with_layers(vec![l])).is_ok()); }
    for keys in [json!([key(1,0.),key(1,0.)]),json!([key(2,0.),key(1,0.)]),json!([key(120,0.)]),json!([{"frame":0.5,"value":0,"easing":"linear"}]),json!([{"frame":0,"value":0,"easing":"custom"}]),json!([{"frame":0,"value":0,"easing":"linear","code":"none"}])] {
        let mut l=primitive(); l["tracks"]["x"]=keys; assert!(validate_project_v2(&with_layers(vec![l])).is_err());
    }
    let mut l=primitive(); l["tracks"]["x"]=json!((0..100).map(|i|key(i,0.)).collect::<Vec<_>>()); assert!(validate_project_v2(&with_layers(vec![l.clone()])).is_ok());
    l["tracks"]["x"].as_array_mut().unwrap().push(key(100,0.)); assert!(validate_project_v2(&with_layers(vec![l])).is_err());
}

#[test]
fn primitive_geometry_style_and_radius_boundaries() {
    for field in ["width","height"] {
        for value in [1.,4096.] { let mut l=primitive(); l[field]=json!(value); assert!(validate_project_v2(&with_layers(vec![l])).is_ok()); }
        for value in [0.,4096.01] { let mut l=primitive(); l[field]=json!(value); assert!(validate_project_v2(&with_layers(vec![l])).is_err()); }
    }
    for kind in ["rect","ellipse"] {
        for r in [Value::Null,json!(0)] { let mut l=primitive(); l["type"]=json!(kind); l["cornerRadius"]=r; assert!(validate_project_v2(&with_layers(vec![l])).is_ok()); }
        let mut l=primitive(); l["type"]=json!(kind); l["cornerRadius"]=json!(if kind=="rect" {8.} else {0.}); assert!(validate_project_v2(&with_layers(vec![l.clone()])).is_ok());
        l["cornerRadius"]=json!(if kind=="rect" {8.01} else {0.01}); assert!(validate_project_v2(&with_layers(vec![l])).is_err());
    }
    for field in ["fill","stroke"] { for value in [json!("#12345"),json!("#1234567"),json!("#GGGGGG"),Value::Null] { let mut l=primitive(); l[field]=value; assert!(validate_project_v2(&with_layers(vec![l])).is_err()); } }
    for value in [-0.01,100.01] { let mut l=primitive(); l["strokeWidth"]=json!(value); assert!(validate_project_v2(&with_layers(vec![l])).is_err()); }
    let mut l=primitive(); l["strokeWidth"]=json!(100); assert!(validate_project_v2(&with_layers(vec![l])).is_ok());
}

#[test]
fn graph_depth_count_and_cumulative_world_limits() {
    let chain = |len: usize| (0..len).map(|i|group(i,i.checked_sub(1))).collect::<Vec<_>>();
    assert!(validate_project_v2(&with_layers(chain(9))).is_ok());
    assert_eq!(validate_project_v2(&with_layers(chain(10))).unwrap_err(),"parent_depth");
    let groups=(0..100).map(|i|group(i,None)).collect::<Vec<_>>(); assert!(validate_project_v2(&with_layers(groups.clone())).is_ok());
    let mut too_many=groups; too_many.push(group(100,None)); assert!(validate_project_v2(&with_layers(too_many)).is_err());
    let mut p=with_layers(chain(3)); p["layers"][0]["parentId"]=json!("g2"); assert_eq!(validate_project_v2(&p).unwrap_err(),"parent_cycle");
    let mut p=with_layers(chain(2)); p["layers"][1]["id"]=json!("g0"); assert_eq!(validate_project_v2(&p).unwrap_err(),"duplicate_id");
    let mut p=with_layers(chain(3)); for i in 0..2 {p["layers"][i]["scale"]=json!(1000);}
    assert!(validate_project_v2(&p).is_ok()); p["layers"][2]["scale"]=json!(1000); assert_eq!(validate_project_v2(&p).unwrap_err(),"world_scale_limit");
    let mut p=with_layers(chain(2)); p["layers"][0]["scale"]=json!(1); assert!(validate_project_v2(&p).is_ok()); p["layers"][1]["tracks"]["scale"]=json!([key(0,99.)]); assert_eq!(validate_project_v2(&p).unwrap_err(),"world_scale_limit");
    let mut p=with_layers(chain(8)); for l in p["layers"].as_array_mut().unwrap() {l["x"]=json!(8192);}
    assert!(validate_project_v2(&p).is_ok()); p["layers"][7]["pivot"]=json!([0.01,0]); assert_eq!(validate_project_v2(&p).unwrap_err(),"world_extent_limit");
    let mut layers=chain(2); for g in &mut layers {g["scale"]=json!(1000);}
    let mut l=primitive(); l["parentId"]=json!("g1"); l["width"]=json!(2000); layers.push(l);
    assert_eq!(validate_project_v2(&with_layers(layers)).unwrap_err(),"world_extent_limit");
}

#[test]
fn aggregate_keys_and_path_vertices_limits() {
    let mut layers=vec![];
    for i in 0..100 {let mut l=primitive(); l["id"]=json!(format!("s{i}")); for prop in ["x","y","scale","rotation","opacity"] {l["tracks"][prop]=json!((0..20).map(|j|key(j,if prop=="scale"||prop=="opacity" {100.}else{0.})).collect::<Vec<_>>());} layers.push(l);}
    let mut p=with_layers(layers); assert!(validate_project_v2(&p).is_ok());
    p["layers"][0]["tracks"]["x"].as_array_mut().unwrap().push(key(20,0.)); assert_eq!(validate_project_v2(&p).unwrap_err(),"total_budget");
    let c=corpus(); let path=c["cases"].as_array().unwrap().iter().flat_map(|c|c["project"]["layers"].as_array().into_iter().flatten()).find(|l|l["type"]=="path").unwrap();
    let mut l=path.clone(); l["parentId"]=Value::Null; l["pivot"]=json!([0,0]);
    for field in ["vertices","inTangents","outTangents"] {l["path"][field]=json!(vec![[0,0];256]);}
    let layers=(0..8).map(|i| {let mut l=l.clone();l["id"]=json!(format!("p{i}"));l}).collect::<Vec<_>>();
    let mut p=with_layers(layers); assert!(validate_project_v2(&p).is_ok());
    l["id"]=json!("p8"); for field in ["vertices","inTangents","outTangents"] {l["path"][field]=json!(vec![[0,0];3]);}
    p["layers"].as_array_mut().unwrap().push(l); assert_eq!(validate_project_v2(&p).unwrap_err(),"total_budget");
    let mut p=with_layers(vec![path.clone()]); p["layers"][0]["parentId"]=Value::Null;
    for field in ["vertices","inTangents","outTangents"] {p["layers"][0]["path"][field]=json!(vec![[0,0];257]);}
    assert!(validate_project_v2(&p).is_err());
}

struct Scratch(std::path::PathBuf);
impl Scratch {
    fn new() -> Self {
        static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let p = std::env::temp_dir().join(format!("moro-native-v2-{}-{}", std::process::id(), NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed)));
        std::fs::create_dir(&p).unwrap(); Self(p)
    }
}
impl Drop for Scratch { fn drop(&mut self) { let _ = std::fs::remove_dir_all(&self.0); } }
fn cli(args: &[&std::ffi::OsStr]) -> std::process::Output {
    std::process::Command::new(env!("CARGO_BIN_EXE_moro-validate-v2")).args(args).output().unwrap()
}
#[test]
fn cli_read_only_success_and_rejection_json() {
    let dir = Scratch::new(); let path = dir.0.join("project.json");
    let bytes = serde_json::to_vec(&project()).unwrap(); std::fs::write(&path, &bytes).unwrap();
    let result = cli(&["--input".as_ref(), path.as_os_str()]);
    assert!(result.status.success(), "{}", String::from_utf8_lossy(&result.stdout));
    let body: Value = serde_json::from_slice(&result.stdout).unwrap();
    assert_eq!(body["valid"], true); assert_eq!(body["localOnly"], true);
    assert!(result.stderr.is_empty()); assert_eq!(std::fs::read(&path).unwrap(), bytes);
    std::fs::write(&path, b"{\"version\":2,\"version\":2}").unwrap();
    let result = cli(&["--input".as_ref(), path.as_os_str()]);
    assert!(!result.status.success());
    assert_eq!(serde_json::from_slice::<Value>(&result.stdout).unwrap()["valid"], false);
    assert_eq!(std::fs::read_dir(&dir.0).unwrap().count(), 1);
}
#[test]
fn cli_refuses_arguments_missing_non_regular_and_oversized_files() {
    let dir = Scratch::new(); let path = dir.0.join("huge.json");
    let f = std::fs::File::create(&path).unwrap(); f.set_len((MAX_PROJECT_BYTES+1) as u64).unwrap();
    let link = dir.0.join("link.json"); std::os::unix::fs::symlink(&path, &link).unwrap();
    let fifo = dir.0.join("pipe");
    let c = std::ffi::CString::new(fifo.as_os_str().as_encoded_bytes()).unwrap();
    assert_eq!(unsafe { libc::mkfifo(c.as_ptr(), 0o600) }, 0);
    let missing = dir.0.join("missing");
    for args in [vec![], vec!["--input".as_ref()], vec!["--help".as_ref()], vec!["--input".as_ref(), "-".as_ref()], vec!["--input".as_ref(), path.as_os_str(), "extra".as_ref()], vec!["--input".as_ref(), dir.0.as_os_str()], vec!["--input".as_ref(), path.as_os_str()], vec!["--input".as_ref(), link.as_os_str()], vec!["--input".as_ref(), fifo.as_os_str()], vec!["--input".as_ref(), missing.as_os_str()]] {
        let out = cli(&args); assert!(!out.status.success());
        assert_eq!(serde_json::from_slice::<Value>(&out.stdout).unwrap()["valid"], false);
        assert!(out.stderr.is_empty());
    }
}

#[test]
fn path_geometry_open_handles_and_exact_fields() {
    let c=corpus();
    let mut l=c["cases"].as_array().unwrap().iter().filter_map(|c|c.get("project")).flat_map(|p|p["layers"].as_array().unwrap()).find(|l|l["type"]=="path").unwrap().clone();
    l["parentId"]=Value::Null;
    for field in ["vertices","inTangents","outTangents"] {
        for point in [json!([4096.01,0]),json!([0]),json!([0,0,0]),json!([0,null])] {
            let mut bad=l.clone();bad["path"][field][0]=point;assert!(validate_project_v2(&with_layers(vec![bad])).is_err(),"{field}");
        }
        let mut bad=l.clone();bad["path"].as_object_mut().unwrap().remove(field);assert!(validate_project_v2(&with_layers(vec![bad])).is_err());
    }
    let mut good=l.clone(); good["path"]["vertices"][0]=json!([4096,4096]); good["path"]["inTangents"][0]=json!([4096,4096]); assert!(validate_project_v2(&with_layers(vec![good])).is_ok());
    for closed in [Value::Null,json!(0),json!("true")] {let mut bad=l.clone();bad["path"]["closed"]=closed;assert!(validate_project_v2(&with_layers(vec![bad])).is_err());}
    let mut open=l.clone();open["path"]["closed"]=json!(false);open["fill"]=Value::Null;
    let last=open["path"]["vertices"].as_array().unwrap().len()-1;
    open["path"]["inTangents"][0]=json!([0,0]);open["path"]["outTangents"][last]=json!([0,0]); assert!(validate_project_v2(&with_layers(vec![open.clone()])).is_ok());
    for (field,i) in [("inTangents",0),("outTangents",last)] {let mut bad=open.clone();bad["path"][field][i]=json!([0.01,0]);assert!(validate_project_v2(&with_layers(vec![bad])).is_err());}
    for field in ["width","code","d","expression"] {let mut bad=l.clone();bad[field]=json!(0);assert!(validate_project_v2(&with_layers(vec![bad])).is_err());}
    let mut bad=l;bad["path"]["extra"]=json!(true);assert!(validate_project_v2(&with_layers(vec![bad])).is_err());
}

#[test]
fn cli_all_shared_corpus_cases_match_without_modifying_inputs() {
    let dir=Scratch::new();let path=dir.0.join("case.json");
    let mut accepted=0;let mut rejected=0;
    for case in corpus()["cases"].as_array().unwrap() {
        let bytes=if let Some(text)=case["text"].as_str() {text.as_bytes().to_vec()} else {serde_json::to_vec(&case["project"]).unwrap()};
        std::fs::write(&path,&bytes).unwrap();let out=cli(&["--input".as_ref(),path.as_os_str()]);
        let valid=case["valid"].as_bool().unwrap();assert_eq!(out.status.success(),valid,"{}",case["id"]);
        let body:Value=serde_json::from_slice(&out.stdout).unwrap();assert_eq!(body["valid"],valid);assert_eq!(body["localOnly"],true);
        assert_eq!(std::fs::read(&path).unwrap(),bytes);assert!(out.stderr.is_empty());
        if valid {accepted+=1;} else {rejected+=1;}
    }
    assert_eq!((accepted,rejected),(3,10));assert_eq!(std::fs::read_dir(&dir.0).unwrap().count(),1);
}

#[test]
fn standalone_v2_schema_is_exact_local_and_variant_specific() {
    let schema: Value = serde_json::from_str(include_str!("../../schemas/creator-project-v2.schema.json")).unwrap();
    assert_eq!(schema["properties"]["version"]["const"], 2);
    assert_eq!(schema["properties"]["layers"]["maxItems"], 100);
    assert_eq!(schema["additionalProperties"], false);
    for variant in ["rect", "ellipse", "path", "group"] {
        let def = &schema["$defs"][variant];
        assert_eq!(def["additionalProperties"], false, "{variant}");
        assert_eq!(def["properties"]["type"]["const"], variant);
        let required = def["required"].as_array().unwrap();
        assert!(required.contains(&json!("parentId")) && required.contains(&json!("pivot")));
        assert_eq!(required.len(), def["properties"].as_object().unwrap().len());
    }
    assert!(schema["$comment"].as_str().unwrap().contains("runtime"));
}

#[test]
fn validates_empty_local_v2_and_rejects_unknown_fields() {
    let p = project();
    assert!(validate_project_v2(&p).is_ok());
    let mut bad = p.clone();
    bad["provider"] = json!("never");
    assert!(validate_project_v2(&bad).is_err());
    bad = p;
    bad["version"] = json!(1);
    assert!(validate_project_v2(&bad).is_err());
}
