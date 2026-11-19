import {applySurfaceDepthBias} from '/demo/agentic-city/surface-depth.mjs';
const sha256=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
// A bad/missing asset falls back per tile to the authoritative live builder.
export function prebuiltRoadLoader(T,P,O){
 let manifestPromise=null;const buffers=new Map();
 async function manifest(){
  manifestPromise??=(async()=>{try{
   const response=await fetch('/demo/agentic-city/road-prebuilt/manifest.json',{cache:'default'});if(!response.ok)return null;const m=await response.json();
   if(m.format!==2||m.geometry_revision!=='layer-road-mesh-v2-pond-banks'||JSON.stringify(m.origin)!==JSON.stringify(O))return null;
   if(m.scene_manifest_sha256!==await sha256(new TextEncoder().encode(JSON.stringify(P.manifest))))return null;
   return m;
  }catch{return null}})();return manifestPromise;
 }
 async function load(tile,dependency,message){
  const m=await manifest(),row=m?.tiles[tile.id];
  // Routing/task revisions do not change road geometry. Scene, geometry revision,
  // network and per-tile edit dependencies above/below determine mesh validity.
  if(!row||m.network_version!==message.network_version||row.stats.key!==dependency.key)return null;
  let bytes=buffers.get(row.sha256);
  if(!bytes){const response=await fetch('/demo/agentic-city/road-prebuilt/'+row.file,{cache:'default'});if(!response.ok)throw Error('预生成Roads读取失败');bytes=await response.arrayBuffer();if(bytes.byteLength!==row.bytes||await sha256(bytes)!==row.sha256)throw Error('预生成Roads校验失败');buffers.set(row.sha256,bytes)}
  return {row,bytes};
 }
 function build({row,bytes}){
  const meshes=[];
  try{for(const record of row.meshes){
   const geometry=new T.BufferGeometry();
   for(const [name,a] of Object.entries(record.attributes))geometry.setAttribute(name,new T.BufferAttribute(new Float32Array(bytes,a.offset,a.count*a.itemSize),a.itemSize));
   if(record.index)geometry.setIndex(new T.BufferAttribute(new Uint32Array(bytes,record.index.offset,record.index.count),1));
   geometry.boundingSphere=new T.Sphere(new T.Vector3(...record.sphere.center),record.sphere.radius);
   const line=record.kind==='line',material=line?new T.LineBasicMaterial({color:'#deded5',depthTest:true}):new T.MeshStandardMaterial({color:record.kind==='structure'?'#66645e':'#575957',roughness:.96,side:T.DoubleSide,depthTest:true,depthWrite:true});
   if(record.kind!=='structure')applySurfaceDepthBias(material,line?.08:.06);
   const mesh=line?new T.LineSegments(geometry,material):new T.Mesh(geometry,material);meshes.push(mesh);
   mesh.userData={...structuredClone(record.userData),reviewText:record.userData.reviewText||'Current路网路面；高程依据原Terrain与Roads连接生成，非实测部分为显示Estimate。'};mesh.renderOrder=record.renderOrder;mesh.receiveShadow=record.receiveShadow;
  }return {meshes,...row.stats};}catch(error){for(const m of meshes){m.geometry.dispose();m.material.dispose()}throw error}
 }
 return {load,build,moduleUrl:import.meta.url};
}

// Immutable binary buffers are shared when baseline meshes are restored.
