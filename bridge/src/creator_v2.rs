//! Local-only v2 project validation. Never invokes providers, inference or user code.
use serde_json::Value;
use std::collections::{HashMap, HashSet};

pub type ValidationError = &'static str;
pub const MAX_PROJECT_BYTES: usize = 8 * 1024 * 1024;
/// Parse bounded UTF-8 JSON with decoded duplicate-key rejection at every depth,
/// then enforce the complete local v2 semantic contract. No file or provider I/O.
pub fn parse_project_v2(bytes: &[u8]) -> Result<Value, ValidationError> {
    let p = parse_json_strict(bytes)?;
    validate_project_v2(&p)?;
    Ok(p)
}

/// Shared duplicate-key/depth decoder for v2 envelopes. Semantics are separate.
pub(crate) fn parse_json_strict(bytes: &[u8]) -> Result<Value, ValidationError> {
    use serde::de::DeserializeSeed;
    if bytes.len() > MAX_PROJECT_BYTES { return Err("project_too_large"); }
    let mut de = serde_json::Deserializer::from_slice(bytes);
    let p = StrictValue(0).deserialize(&mut de).map_err(|_| "invalid_json")?;
    de.end().map_err(|_| "invalid_json")?;
    Ok(p)
}

// Deserialize directly rather than using Value's last-key-wins deserializer.
// Depth counts object/array containers, with the root container at depth one.
struct StrictValue(usize);
impl<'de> serde::de::DeserializeSeed<'de> for StrictValue {
    type Value = Value;
    fn deserialize<D: serde::Deserializer<'de>>(self, d: D) -> Result<Value, D::Error> {
        d.deserialize_any(self)
    }
}
impl<'de> serde::de::Visitor<'de> for StrictValue {
    type Value = Value;
    fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result { f.write_str("bounded strict JSON") }
    fn visit_bool<E: serde::de::Error>(self, v: bool) -> Result<Value, E> { Ok(Value::Bool(v)) }
    fn visit_i64<E: serde::de::Error>(self, v: i64) -> Result<Value, E> { Ok(v.into()) }
    fn visit_u64<E: serde::de::Error>(self, v: u64) -> Result<Value, E> { Ok(v.into()) }
    fn visit_f64<E: serde::de::Error>(self, v: f64) -> Result<Value, E> {
        serde_json::Number::from_f64(v).map(Value::Number).ok_or_else(|| E::custom("nonfinite_number"))
    }
    fn visit_str<E: serde::de::Error>(self, v: &str) -> Result<Value, E> { Ok(Value::String(v.to_owned())) }
    fn visit_string<E: serde::de::Error>(self, v: String) -> Result<Value, E> { Ok(Value::String(v)) }
    fn visit_unit<E: serde::de::Error>(self) -> Result<Value, E> { Ok(Value::Null) }
    fn visit_none<E: serde::de::Error>(self) -> Result<Value, E> { Ok(Value::Null) }
    fn visit_seq<A: serde::de::SeqAccess<'de>>(self, mut a: A) -> Result<Value, A::Error> {
        use serde::de::Error;
        if self.0 >= MAX_JSON_DEPTH { return Err(A::Error::custom("json_depth_limit")); }
        let mut values = Vec::new();
        while let Some(v) = a.next_element_seed(StrictValue(self.0 + 1))? { values.push(v); }
        Ok(Value::Array(values))
    }
    fn visit_map<A: serde::de::MapAccess<'de>>(self, mut a: A) -> Result<Value, A::Error> {
        use serde::de::Error;
        if self.0 >= MAX_JSON_DEPTH { return Err(A::Error::custom("json_depth_limit")); }
        let mut values = serde_json::Map::new();
        while let Some(k) = a.next_key::<String>()? {
            if values.contains_key(&k) { return Err(A::Error::custom("duplicate_json_key")); }
            values.insert(k, a.next_value_seed(StrictValue(self.0 + 1))?);
        }
        Ok(Value::Object(values))
    }
}

pub const MAX_JSON_DEPTH: usize = 32;
const PROPS: [&str; 5] = ["x", "y", "scale", "rotation", "opacity"];
const COMMON: [&str; 11] = ["id", "name", "type", "parentId", "x", "y", "pivot", "scale", "rotation", "opacity", "tracks"];

fn exact(v: &Value, keys: &[&str]) -> Result<(), ValidationError> {
    let o = v.as_object().ok_or("invalid_object")?;
    if o.len() != keys.len() || keys.iter().any(|k| !o.contains_key(*k)) {
        return Err("invalid_fields");
    }
    Ok(())
}
fn text(v: &Value) -> Result<(), ValidationError> {
    let s = v.as_str().ok_or("invalid_text")?;
    // Match ECMAScript String.trim, not Rust's subtly different Unicode whitespace set.
    let blank = s.trim_matches(|c: char| matches!(c, '\u{9}'..='\u{d}' | ' ' | '\u{a0}' | '\u{1680}' | '\u{2000}'..='\u{200a}' | '\u{2028}' | '\u{2029}' | '\u{202f}' | '\u{205f}' | '\u{3000}' | '\u{feff}')).is_empty();
    if blank || s.encode_utf16().count() > 200 || s.chars().any(|c| c <= '\u{1f}' || ('\u{7f}'..='\u{9f}').contains(&c)) {
        return Err("invalid_text");
    }
    Ok(())
}
fn number(v: &Value, lo: f64, hi: f64, integer: bool) -> Result<f64, ValidationError> {
    let n = v.as_f64().ok_or("invalid_number")?;
    if !n.is_finite() || n < lo || n > hi || (integer && n.fract() != 0.) {
        return Err("invalid_number");
    }
    Ok(n)
}
fn range(p: &str) -> (f64, f64) {
    match p { "scale" => (1., 1000.), "rotation" => (-3600., 3600.), "opacity" => (0., 100.), _ => (-8192., 8192.) }
}
fn vec2(v: &Value) -> Result<[f64; 2], ValidationError> {
    let a = array(v, 2)?;
    if a.len() != 2 { return Err("invalid_vector"); }
    Ok([number(&a[0], -4096., 4096., false)?, number(&a[1], -4096., 4096., false)?])
}
fn array(v: &Value, max: usize) -> Result<&Vec<Value>, ValidationError> {
    v.as_array().filter(|a| a.len() <= max).ok_or("invalid_array")
}
fn color(v: &Value) -> Result<(), ValidationError> {
    if v.as_str().is_some_and(|s| s.len() == 7 && s.starts_with('#') && s.as_bytes()[1..].iter().all(u8::is_ascii_hexdigit)) { Ok(()) } else { Err("invalid_color") }
}
fn n(v: &Value) -> f64 { v.as_f64().expect("validated number") }
fn channel_extrema(l: &Value, prop: &str) -> (f64, f64) {
    let mut lo = n(&l[prop]);
    let mut hi = lo;
    for k in l["tracks"][prop].as_array().expect("validated tracks") {
        lo = lo.min(n(&k["value"])); hi = hi.max(n(&k["value"]));
    }
    (lo, hi)
}
fn abs_ext(l: &Value, prop: &str) -> f64 {
    let (lo, hi) = channel_extrema(l, prop); lo.abs().max(hi.abs())
}

/// Validate an already materialized JSON value. Duplicate keys must be caught by
/// `parse_project_v2`; a Value cannot retain duplicate-key provenance.
pub fn validate_project_v2(p: &Value) -> Result<(), ValidationError> {
    exact(p, &["version", "name", "width", "height", "fps", "durationFrames", "layers"])?;
    if p["version"].as_f64() != Some(2.) { return Err("invalid_version"); }
    text(&p["name"])?;
    for prop in ["width", "height"] { number(&p[prop], 16., 4096., true)?; }
    number(&p["fps"], 1., 120., true)?;
    let duration = number(&p["durationFrames"], 2., 3600., true)?;
    let layers = array(&p["layers"], 100)?;
    let mut ids = HashMap::new();
    let mut vertices_total = 0;
    let mut keys_total = 0;
    for l in layers {
        let kind = l["type"].as_str().ok_or("invalid_layer_type")?;
        let mut fields = COMMON.to_vec();
        match kind {
            "group" => (),
            "path" => fields.extend(["path", "fill", "stroke", "strokeWidth"]),
            "rect" | "ellipse" => fields.extend(["width", "height", "cornerRadius", "fill", "stroke", "strokeWidth"]),
            _ => return Err("invalid_layer_type"),
        }
        exact(l, &fields)?;
        text(&l["id"])?; text(&l["name"])?;
        if !l["parentId"].is_null() { text(&l["parentId"])?; }
        if ids.insert(l["id"].as_str().unwrap(), l).is_some() { return Err("duplicate_id"); }
        vec2(&l["pivot"])?;
        exact(&l["tracks"], &PROPS)?;
        for prop in PROPS {
            let (lo, hi) = range(prop);
            number(&l[prop], lo, hi, false)?;
            let keys = array(&l["tracks"][prop], 100)?;
            keys_total += keys.len();
            let mut previous = -1.;
            for key in keys {
                exact(key, &["frame", "value", "easing"])?;
                let frame = number(&key["frame"], 0., duration - 1., true)?;
                number(&key["value"], lo, hi, false)?;
                if frame <= previous || !matches!(key["easing"].as_str(), Some("linear" | "ease-in" | "ease-out" | "ease-in-out")) { return Err("invalid_key"); }
                previous = frame;
            }
        }
        if kind == "group" {
            if n(&l["opacity"]) != 100. || !l["tracks"]["opacity"].as_array().unwrap().is_empty() { return Err("group_opacity"); }
            continue;
        }
        color(&l["stroke"])?;
        number(&l["strokeWidth"], 0., 100., false)?;
        if !(kind == "path" && l["fill"].is_null()) { color(&l["fill"])?; }
        if kind != "path" {
            let w = number(&l["width"], 1., 4096., false)?;
            let h = number(&l["height"], 1., 4096., false)?;
            if !l["cornerRadius"].is_null() { number(&l["cornerRadius"], 0., if kind == "rect" { w.min(h)/2. } else { 0. }, false)?; }
        } else {
            let path = &l["path"];
            exact(path, &["closed", "vertices", "inTangents", "outTangents"])?;
            let closed = path["closed"].as_bool().ok_or("invalid_closed")?;
            let vertices = array(&path["vertices"], 256)?;
            let ins = array(&path["inTangents"], 256)?;
            let outs = array(&path["outTangents"], 256)?;
            if vertices.len() < if closed { 3 } else { 2 } || ins.len() != vertices.len() || outs.len() != vertices.len() { return Err("invalid_path_length"); }
            vertices_total += vertices.len();
            for i in 0..vertices.len() {
                let v = vec2(&vertices[i])?;
                for ts in [ins, outs] {
                    let t = vec2(&ts[i])?;
                    for a in 0..2 { if (v[a] + t[a]).abs() > 8192. { return Err("control_point_limit"); } }
                }
            }
            if !closed && (!l["fill"].is_null() || vec2(&ins[0])? != [0., 0.] || vec2(&outs[outs.len()-1])? != [0., 0.]) { return Err("invalid_open_path"); }
        }
    }
    if vertices_total > 2048 || keys_total > 10000 { return Err("total_budget"); }
    for l in layers {
        let mut chain = vec![];
        let mut seen = HashSet::new();
        let mut node = l;
        loop {
            if !seen.insert(node["id"].as_str().unwrap()) { return Err("parent_cycle"); }
            chain.push(node);
            if chain.len() > 9 { return Err("parent_depth"); }
            if node["parentId"].is_null() { break; }
            node = ids.get(node["parentId"].as_str().unwrap()).copied().ok_or("missing_parent")?;
            if node["type"] != "group" { return Err("non_group_parent"); }
        }
        let (mut min_scale, mut max_scale, mut origin) = (1., 1., 0.);
        for node in chain.into_iter().rev() {
            let (lo, hi) = channel_extrema(node, "scale");
            let pivot = vec2(&node["pivot"])?;
            origin += max_scale * (abs_ext(node, "x").hypot(abs_ext(node, "y")) + hi / 100. * pivot[0].hypot(pivot[1]));
            min_scale *= lo / 100.; max_scale *= hi / 100.;
            if min_scale < 0.01 - 1e-12 || max_scale > 100. + 1e-12 { return Err("world_scale_limit"); }
            if origin > 65536. { return Err("world_extent_limit"); }
        }
        let mut radius: f64 = 0.;
        match l["type"].as_str().unwrap() {
            "group" => (),
            "path" => {
                let path = &l["path"];
                for (i, p) in path["vertices"].as_array().unwrap().iter().enumerate() {
                    let p = vec2(p)?;
                    for t in [[0.,0.], vec2(&path["inTangents"][i])?, vec2(&path["outTangents"][i])?] {
                        radius = radius.max((p[0]+t[0]).hypot(p[1]+t[1]));
                    }
                }
                radius += n(&l["strokeWidth"])/2.;
            },
            _ => radius = (n(&l["width"])/2.).hypot(n(&l["height"])/2.) + n(&l["strokeWidth"])/2. * std::f64::consts::SQRT_2,
        }
        if origin + max_scale * radius > 65536. { return Err("world_extent_limit"); }
    }
    if serde_json::to_vec(p).map_err(|_| "invalid_json")?.len() > MAX_PROJECT_BYTES { return Err("project_too_large"); }
    Ok(())
}
