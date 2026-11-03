//! Standalone ProjectV3 validator. No provider, filesystem, migration or repair.
use serde_json::Value;
use std::collections::{HashMap,HashSet};
pub type ValidationError = &'static str;
pub const MAX_PROJECT_BYTES:usize=crate::creator_v2::MAX_PROJECT_BYTES;
const PROPS:[&str;8]=["x","y","scaleX","scaleY","rotation","opacity","skew","skewAxis"];
const COMMON:[&str;16]=["id","name","type","parentId","x","y","pivot","scaleX","scaleY","rotation","opacity","skew","skewAxis","tracks","masks","trim"];
pub fn parse_project_v3(bytes:&[u8])->Result<Value,ValidationError>{let p=crate::creator_v2::parse_json_strict(bytes)?;validate_project_v3(&p)?;Ok(p)}
pub(crate) fn exact(v:&Value,keys:&[&str])->Result<(),ValidationError>{let o=v.as_object().ok_or("invalid_object")?;if o.len()!=keys.len()||keys.iter().any(|k|!o.contains_key(*k)){return Err("invalid_fields");}Ok(())}
fn text(v:&Value)->Result<(),ValidationError>{
 let s=v.as_str().ok_or("invalid_text")?;
 let blank=s.trim_matches(|c:char|matches!(c,'\u{9}'..='\u{d}'|' '|'\u{a0}'|'\u{1680}'|'\u{2000}'..='\u{200a}'|'\u{2028}'|'\u{2029}'|'\u{202f}'|'\u{205f}'|'\u{3000}'|'\u{feff}')).is_empty();
 if blank||s.encode_utf16().count()>200||s.chars().any(|c|c<='\u{1f}'||('\u{7f}'..='\u{9f}').contains(&c)){return Err("invalid_text");}Ok(())
}
fn number(v:&Value,lo:f64,hi:f64,integer:bool)->Result<f64,ValidationError>{let n=v.as_f64().ok_or("invalid_number")?;if !n.is_finite()||n<lo||n>hi||(integer&&n.fract()!=0.){return Err("invalid_number");}Ok(n)}
fn array(v:&Value,max:usize)->Result<&Vec<Value>,ValidationError>{v.as_array().filter(|a|a.len()<=max).ok_or("invalid_array")}
fn vec2(v:&Value)->Result<[f64;2],ValidationError>{let a=array(v,2)?;if a.len()!=2{return Err("invalid_vector");}Ok([number(&a[0],-4096.,4096.,false)?,number(&a[1],-4096.,4096.,false)?])}
fn color(v:&Value)->Result<(),ValidationError>{if v.as_str().is_some_and(|s|s.len()==7&&s.starts_with('#')&&s.as_bytes()[1..].iter().all(u8::is_ascii_hexdigit)){Ok(())}else{Err("invalid_color")}}
fn range(p:&str)->(f64,f64){match p{"scaleX"|"scaleY"=>(1.,1000.),"rotation"|"skewAxis"|"offset"=>(-3600.,3600.),"opacity"|"start"|"end"=>(0.,100.),"skew"=>(-75.,75.),_=>(-8192.,8192.)}}
fn easing(v:&Value)->Result<(),ValidationError>{if matches!(v.as_str(),Some("linear"|"ease-in"|"ease-out"|"ease-in-out")){return Ok(());}exact(v,&["type","x1","y1","x2","y2"])?;if v["type"]!="cubic-bezier"{return Err("invalid_easing");}for p in ["x1","y1","x2","y2"]{number(&v[p],0.,1.,false)?;}Ok(())}
fn keys(v:&Value,duration:f64,total:&mut usize,mut value:impl FnMut(&Value)->Result<(),ValidationError>)->Result<(),ValidationError>{
 let ks=array(v,100)?;*total+=ks.len();let mut prev=-1.;
 for k in ks{exact(k,&["frame","value","easing"])?;let frame=number(&k["frame"],0.,duration-1.,true)?;if frame<=prev{return Err("invalid_key");}prev=frame;easing(&k["easing"])?;value(&k["value"])?;}Ok(())
}
fn geometry(p:&Value)->Result<usize,ValidationError>{
 exact(p,&["closed","vertices","inTangents","outTangents"])?;let closed=p["closed"].as_bool().ok_or("invalid_closed")?;
 let vs=array(&p["vertices"],256)?;let ins=array(&p["inTangents"],256)?;let outs=array(&p["outTangents"],256)?;
 if vs.len()<if closed{3}else{2}||ins.len()!=vs.len()||outs.len()!=vs.len(){return Err("invalid_path_length");}
 for i in 0..vs.len(){let v=vec2(&vs[i])?;for ts in [ins,outs]{let t=vec2(&ts[i])?;for a in 0..2{if (v[a]+t[a]).abs()>8192.{return Err("control_point_limit");}}}}
 if !closed&&(vec2(&ins[0])?!=[0.,0.]||vec2(&outs[vs.len()-1])?!=[0.,0.]){return Err("invalid_open_path");}Ok(vs.len())
}
fn n(v:&Value)->f64{v.as_f64().expect("validated number")}
fn extrema(l:&Value,p:&str)->(f64,f64){let mut lo=n(&l[p]);let mut hi=lo;for k in l["tracks"][p].as_array().unwrap(){lo=lo.min(n(&k["value"]));hi=hi.max(n(&k["value"]));}(lo,hi)}
fn abs_ext(l:&Value,p:&str)->f64{let (a,b)=extrema(l,p);a.abs().max(b.abs())}
fn path_radius(p:&Value)->f64{let mut r:f64=0.;for (i,v) in p["vertices"].as_array().unwrap().iter().enumerate(){let v=vec2(v).unwrap();for t in [[0.,0.],vec2(&p["inTangents"][i]).unwrap(),vec2(&p["outTangents"][i]).unwrap()]{r=r.max((v[0]+t[0]).hypot(v[1]+t[1]));}}r}
/// All fields required and no extra fields. Values cannot preserve duplicate-key
/// provenance: parse_project_v3 is the entry point for untrusted JSON bytes.
pub fn validate_project_v3(p:&Value)->Result<(),ValidationError>{
 exact(p,&["version","name","width","height","fps","durationFrames","layers"])?;
 if p["version"].as_f64()!=Some(3.){return Err("invalid_version");}text(&p["name"])?;
 for prop in ["width","height"]{number(&p[prop],16.,4096.,true)?;}number(&p["fps"],1.,120.,true)?;let duration=number(&p["durationFrames"],2.,3600.,true)?;
 let layers=array(&p["layers"],100)?;let mut ids=HashMap::new();let(mut total_vertices,mut total_keys,mut morph_vertices)=(0,0,0);
 for l in layers{
  let kind=l["type"].as_str().ok_or("invalid_layer_type")?;let mut fields=COMMON.to_vec();match kind{"group"=>(),"path"=>fields.extend(["path","fill","stroke","strokeWidth","pathKeys"]),"rect"|"ellipse"=>fields.extend(["width","height","cornerRadius","fill","stroke","strokeWidth"]),_=>return Err("invalid_layer_type")};exact(l,&fields)?;
  text(&l["id"])?;text(&l["name"])?;if !l["parentId"].is_null(){text(&l["parentId"])?;}if ids.insert(l["id"].as_str().unwrap(),l).is_some(){return Err("duplicate_id");}vec2(&l["pivot"])?;exact(&l["tracks"],&PROPS)?;
  for prop in PROPS{let(lo,hi)=range(prop);number(&l[prop],lo,hi,false)?;keys(&l["tracks"][prop],duration,&mut total_keys,|v|number(v,lo,hi,false).map(|_|()))?;}
  let masks=array(&l["masks"],4)?;
  if kind=="group"{if n(&l["opacity"])!=100.||!l["tracks"]["opacity"].as_array().unwrap().is_empty()||!masks.is_empty()||!l["trim"].is_null(){return Err("invalid_group");}continue;}
  for m in masks{exact(m,&["name","mode","inverted","opacity","path"])?;text(&m["name"])?;if !matches!(m["mode"].as_str(),Some("add"|"subtract"))||!m["inverted"].is_boolean(){return Err("invalid_mask");}number(&m["opacity"],0.,100.,false)?;total_vertices+=geometry(&m["path"])?;}
  color(&l["stroke"])?;number(&l["strokeWidth"],0.,100.,false)?;if !(kind=="path"&&l["fill"].is_null()){color(&l["fill"])?;}
  if kind=="path"{
   let count=geometry(&l["path"])?;total_vertices+=count;
   if l["path"]["closed"]==false&&!l["fill"].is_null(){return Err("invalid_open_path");}
   keys(&l["pathKeys"],duration,&mut total_keys,|v|{let c=geometry(v)?;if c!=count||v["closed"]!=l["path"]["closed"]{return Err("morph_topology");}morph_vertices+=c;Ok(())})?;
   if !l["trim"].is_null(){let t=&l["trim"];exact(t,&["start","end","offset","tracks"])?;exact(&t["tracks"],&["start","end","offset"])?;for prop in ["start","end","offset"]{let(lo,hi)=range(prop);number(&t[prop],lo,hi,false)?;keys(&t["tracks"][prop],duration,&mut total_keys,|v|number(v,lo,hi,false).map(|_|()))?;}}
  }else{
   if !l["trim"].is_null(){return Err("invalid_trim");}let w=number(&l["width"],1.,4096.,false)?;let h=number(&l["height"],1.,4096.,false)?;if !l["cornerRadius"].is_null(){number(&l["cornerRadius"],0.,if kind=="rect"{w.min(h)/2.}else{0.},false)?;}
  }
 }
 if total_vertices>2048||total_keys>10000||morph_vertices>16384{return Err("total_budget");}
 for l in layers{
  let mut chain=vec![];let mut seen=HashSet::new();let mut node=l;
  loop{if !seen.insert(node["id"].as_str().unwrap()){return Err("parent_cycle");}chain.push(node);if chain.len()>9{return Err("parent_depth");}if node["parentId"].is_null(){break;}node=ids.get(node["parentId"].as_str().unwrap()).copied().ok_or("missing_parent")?;if node["type"]!="group"{return Err("non_group_parent");}}
  let(mut min_scale,mut max_scale,mut origin)=(1.,1.,0.);
  for node in chain.into_iter().rev(){
   let(xlo,xhi)=extrema(node,"scaleX");let(ylo,yhi)=extrema(node,"scaleY");
   // Spectral-norm bound for arbitrary skew axis: ||shear|| <= 1+|tan(skew)|.
   // Rotation/skewAxis are norm preserving; this bound covers every frame.
   let shear=1.+abs_ext(node,"skew").to_radians().tan().abs();
   let hi=xhi.max(yhi)/100.*shear;let lo=xlo.min(ylo)/100./shear;
   let pivot=vec2(&node["pivot"])?;origin+=max_scale*(abs_ext(node,"x").hypot(abs_ext(node,"y"))+hi*pivot[0].hypot(pivot[1]));
   min_scale*=lo;max_scale*=hi;if min_scale<0.01-1e-12||max_scale>100.+1e-12{return Err("world_scale_limit");}if !origin.is_finite()||origin>65536.{return Err("world_extent_limit");}
  }
  let mut radius:f64=match l["type"].as_str().unwrap(){"group"=>0.,"path"=>{let mut r=path_radius(&l["path"]);for k in l["pathKeys"].as_array().unwrap(){r=r.max(path_radius(&k["value"]));}r+n(&l["strokeWidth"])/2.},_=>(n(&l["width"])/2.).hypot(n(&l["height"])/2.)+n(&l["strokeWidth"])/2.*std::f64::consts::SQRT_2};
  for m in l["masks"].as_array().unwrap(){radius=radius.max(path_radius(&m["path"]));}
  if !radius.is_finite()||origin+max_scale*radius>65536.{return Err("world_extent_limit");}
 }
 if serde_json::to_vec(p).map_err(|_|"invalid_json")?.len()>MAX_PROJECT_BYTES{return Err("project_too_large");}Ok(())
}
