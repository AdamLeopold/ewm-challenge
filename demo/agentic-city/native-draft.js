import {decoratePlannedBuilding} from '/demo/agentic-city/studio/building-details.js';
import {surfaceLayer} from '/demo/agentic-city/road-surfaces-3d.js';
import * as T from 'three';
import {terrainIndex} from '/demo/agentic-city/terrain-query.mjs';
import {colorBuilding,createDraftMaterial} from '/demo/agentic-city/native/colored/building-style.js?v=building-one-door-96';
import {buildLayout} from '/demo/agentic-city/native/colored/facade-layout.mjs?v=building-one-door-96';
import {applySurfaceDepthBias} from '/demo/agentic-city/native/colored/surface-depth.js';
while(!window.preview?.ready)await new Promise(r=>setTimeout(r,100));
const P=window.preview,O=P.manifest.origin,buildingOverlay=new T.Group(),busOverlay=new T.Group(),pondOverlay=new T.Group();
P.groups.TERRAIN.add(pondOverlay);P.groups.BUILDING.add(buildingOverlay);P.groups.INFRASTRUCTURE.add(busOverlay);
const originalAppearance=structuredClone(window.buildingAppearanceRecords);
const originals=new Map(),metadata=new Map();let ticket=0,visible=true;
P.groups.BUILDING.traverse(m=>{if(m.isMesh&&m.userData.ranges)originals.set(m,m.geometry.index.array.slice())});
function clear(g){for(let m of [...g.children]){m.geometry?.dispose();m.material?.dispose();g.remove(m)}}
const groundCache=new Map();
let baseGroundQuery=null;
function indexedGround(){if(baseGroundQuery)return baseGroundQuery;P.groups.TERRAIN.updateWorldMatrix(true,true);let meshes=[],count=0;P.groups.TERRAIN.traverse(m=>{if(m.isMesh&&m.parent!==pondOverlay&&!m.userData.visualSurfaceOnly){meshes.push(m);count+=(m.geometry.index?.count||m.geometry.attributes.position.count)*3}});const triangles=new Float64Array(count);let cursor=0,v=new T.Vector3();for(const m of meshes){const p=m.geometry.attributes.position,ix=m.geometry.index,n=ix?.count||p.count;for(let j=0;j<n;j++){v.fromBufferAttribute(p,ix?ix.getX(j):j).applyMatrix4(m.matrixWorld);triangles[cursor++]=v.x;triangles[cursor++]=v.y;triangles[cursor++]=v.z}}return baseGroundQuery=terrainIndex(triangles)}
function ground(x,y,optional=false){let key=x.toFixed(3)+","+y.toFixed(3);if(groundCache.has(key))return groundCache.get(key);let z=indexedGround()(x,y);if(pondOverlay.children.length){const hits=new T.Raycaster(new T.Vector3(x,y,3000),new T.Vector3(0,0,-1)).intersectObjects(pondOverlay.children,true);if(hits.length)z=Math.max(z??-Infinity,hits[0].point.z)}if(z===null){if(optional)return 0;throw Error('规划objects缺少3DTerrain覆盖，None法完成显示同步')}groundCache.set(key,z);return z}

const canonicalSurfaceLayer=surfaceLayer(T,P,O,(x,y)=>indexedGround()(x,y),(x,y)=>indexedGround().nearest(x,y,250));
function material(color,bias=.1){return applySurfaceDepthBias(new T.MeshStandardMaterial({color,roughness:.94,side:T.DoubleSide}),bias)}
function mesh(vertices,mat,group,info){if(!vertices.length)return;let g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();let m=new T.Mesh(g,mat);m.userData=info;m.receiveShadow=true;group.add(m);return m}
function filledGroundMaterial(){
 const source=P.terrainMaterial;
 const m=source.clone();m.defines={...source.defines};m.defaultAttributeValues=source.defaultAttributeValues;
 m.onBeforeCompile=function(shader,renderer){source.onBeforeCompile.call(this,shader,renderer);shader.fragmentShader=shader.fragmentShader.replace('diffuseColor.rgb=base;','diffuseColor.rgb=sharedSoil*.9;');};
 applySurfaceDepthBias(m,.16);m.customProgramCacheKey=()=> 'filled-pond-shared-soil-v1';return m;
}
function polys(g){return g.type==='Polygon'?[g.coordinates]:g.coordinates}
function buildingGeometry(b){
 const vertices=[],bases=[],height=b.height_m||9,opened=b.use==='shelter';
 function ringPoints(ring){const out=[];for(let i=1;i<ring.length;i++){const a=ring[i-1],c=ring[i],n=Math.max(1,Math.ceil(Math.hypot(c[0]-a[0],c[1]-a[1])/2));for(let j=0;j<n;j++)out.push(new T.Vector2(a[0]+(c[0]-a[0])*j/n-O[0],a[1]+(c[1]-a[1])*j/n-O[1]));}return out;}
 for(const poly of polys(b.geometry)){
  const rings=poly.map(ringPoints),points=rings[0],shape=new T.Shape(points);for(const ring of rings.slice(1))shape.holes.push(new T.Path(ring));
  const base=Math.max(...rings.flat().map(p=>ground(p.x,p.y)));bases.push(base);
  const g=new T.ExtrudeGeometry(shape,{depth:opened?.18:height,bevelEnabled:false});g.translate(0,0,base+(opened?height-.18:0));
  const a=g.attributes.position.array;
  if(!opened)for(let i=0;i<a.length;i+=3)if(Math.abs(a[i+2]-base)<.001)a[i+2]=Math.min(base,ground(a[i],a[i+1]));
  vertices.push(...a);g.dispose();
  if(opened){const stride=Math.max(1,Math.floor(points.length/6));for(let i=0;i<points.length;i+=stride){const point=points[i],post=new T.BoxGeometry(.2,.2,height).toNonIndexed();post.translate(point.x,point.y,base+height/2);const a=post.attributes.position.array;for(let j=0;j<a.length;j+=3)if(Math.abs(a[j+2]-base)<.001)a[j+2]=Math.min(base,ground(a[j],a[j+1]));vertices.push(...a);post.dispose();}}
 }
 P.buildingMetadata[b.id].surface_base_mPD=Math.min(...bases);
 return geometry(vertices);
}
function geometry(vertices){let g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(Array.from({length:vertices.length/3},(_,i)=>i));g.computeVertexNormals();return g}
function existingGeometry(id){let vertices=[];for(let [m,ix] of originals){let q=m.userData.ranges.find(r=>r.id===id);if(!q)continue;for(let i=q.start*3;i<q.end*3;i++){let v=ix[i];vertices.push(m.geometry.attributes.position.getX(v),m.geometry.attributes.position.getY(v),m.geometry.attributes.position.getZ(v))}}if(!vertices.length)throw Error('缺少既有Buildings网格 '+id);return geometry(vertices)}
function styledBuilding(b,atlas){let g=b.replace_geometry?buildingGeometry(b):existingGeometry(b.id),r={ranges:[{id:b.id,start:0,end:g.index.count/3}]};colorBuilding(g,r,P.buildingMetadata,{regenerate:true});let layout=buildLayout(g.attributes.position.array,g.index.array,r.ranges,P.buildingMetadata,atlas);g.setAttribute('wallFrame',new T.BufferAttribute(layout.frame,4));g.setAttribute('wallLayout',new T.BufferAttribute(layout.layout,4));let m=new T.Mesh(g);m.castShadow=m.receiveShadow=true;m.userData={id:b.id,ranges:r.ranges,draftAppearance:true,layout:layout.records[0],reviewText:`Current规划Buildings：${b.name||b.id}\nUse：${b.use_label||b.use}\n原版门窗、屋顶Direction及材质Rule自动生成；外观为场景Estimate，非实测立面。`};buildingOverlay.add(m);return layout.records[0]}
const buildingRanges=new Map(),appearanceById=new Map();
for(const [m,ix] of originals)for(const r of m.userData.ranges){if(!buildingRanges.has(r.id))buildingRanges.set(r.id,[]);buildingRanges.get(r.id).push({m,ix,r});}
let lastBuildings={},lastPonds={},lastBuses={};
function changedKeys(a,b){return new Set([...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k])))}
function bounds(g){const points=[];function walk(c){if(typeof c[0]==='number')points.push(c);else for(const p of c)walk(p)}walk(g.coordinates);return points.reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity])}
function overlaps(a,b){return a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1]}
function removeChanged(group,ids){for(const m of [...group.children])if(ids.has(m.userData.id)){m.geometry.dispose();m.material.dispose();group.remove(m)}}
function apply(d,previewPaths,syncKey,timing){
 const begin=performance.now(),nextPonds=Object.fromEntries((d.ponds||[]).map(p=>[p.id,p])),changedPonds=changedKeys(lastPonds,nextPonds);
 const pondBounds=[...changedPonds].flatMap(id=>[lastPonds[id],nextPonds[id]].filter(Boolean).map(p=>bounds(p.geometry)));
 removeChanged(pondOverlay,changedPonds);
 for(let p of Object.values(nextPonds).filter(p=>changedPonds.has(p.id)))for(let poly of polys(p.geometry)){let shape=new T.Shape(poly[0].map(q=>new T.Vector2(q[0]-O[0],q[1]-O[1])));for(let ring of poly.slice(1))shape.holes.push(new T.Path(ring.map(q=>new T.Vector2(q[0]-O[0],q[1]-O[1]))));let m=new T.Mesh(new T.ShapeGeometry(shape),filledGroundMaterial());m.position.z=p.target_mPD;m.userData={id:p.id,reviewText:'已填Pond '+p.id+'；Post-fill elevation '+p.target_mPD.toFixed(2)+'mPD（Terrain推算的场景Estimate，非实测）'};pondOverlay.add(m)}

 if(changedPonds.size){
  groundCache.clear();
  // Hide exactly the filled pond triangles, restore their source indices on undo.
  P.groups.TERRAIN.traverse(m=>{if(!m.isMesh||!m.userData.waterRanges)return;let changed=false;for(const r of m.userData.waterRanges){if(!changedPonds.has(r.id))continue;const ix=m.geometry.index.array;if(nextPonds[r.id])ix.fill(0,r.start,r.end);else ix.set(m.userData.originalWaterIndices.subarray(r.start,r.end),r.start);changed=true}if(changed)m.geometry.index.needsUpdate=true});
 }
 timing.ponds_ms=performance.now()-begin;const buildingStart=performance.now();
 const changedBuildings=changedKeys(lastBuildings,d.buildings);
 for(const [id,b] of Object.entries(d.buildings))if(b?.replace_geometry&&pondBounds.some(p=>overlaps(bounds(b.geometry),p)))changedBuildings.add(id);
 removeChanged(buildingOverlay,changedBuildings);
 for(const id of changedBuildings){
  appearanceById.delete(id);
  if(originalAppearance[id])window.buildingAppearanceRecords[id]=structuredClone(originalAppearance[id]);else delete window.buildingAppearanceRecords[id];
  if(metadata.has(id)){const m=metadata.get(id);if(m===undefined)delete P.buildingMetadata[id];else P.buildingMetadata[id]=structuredClone(m);}
  const b=d.buildings[id];
  for(const {m,ix,r} of buildingRanges.get(id)||[]){const start=r.start*3,end=r.end*3;m.geometry.index.array.set(ix.subarray(start,end),start);if(b===null||b?.refresh_appearance)m.geometry.index.array.fill(0,start,end);m.geometry.index.needsUpdate=true;}
 }
 for(let id of changedBuildings){const b=d.buildings[id];if(b===undefined)continue;if(!metadata.has(id))metadata.set(id,P.buildingMetadata[id]?structuredClone(P.buildingMetadata[id]):undefined);if(!b){delete P.buildingMetadata[id];delete window.buildingAppearanceRecords[id];continue}let previous=P.buildingMetadata[id]||{},useChanged=b.use!==b.original_use;
 P.buildingMetadata[id]={...previous,id,name:b.name,type_label:b.use_label||b.use,current_use:b.use,current_use_label:b.use_label||b.use,appearance_use:b.use,appearance_basis:'按CurrentUse、实际Display网格和原版门窗/屋顶Rule生成；颜色、门窗位置及屋面材质均为场景Estimate，非实拍纹理',capacity:b.capacity||{residents:b.residents,jobs:b.jobs},capacity_metrics:b.capacity_metrics,capacity_source_status:Object.fromEntries(Object.entries(b.capacity_metrics||{}).map(([k,v])=>[k,v.source]))};
 if(b.replace_geometry)Object.assign(P.buildingMetadata[id],{height_m:b.height_m||9,height_basis:'contestant_plan',height_source:'参赛者规划Height',method:'planned_extrusion',source_geometry:'按Current2D规划轮廓生成',source_model_ids:[],registration_revision:undefined,display_foundation_repair:undefined,support_original_vertex_count:undefined,support_foundation_vertex_count:undefined,support_basis:'original terrain with generated foundation',support_review:undefined,height_assessment:undefined,appearance_status:'原版Rule生成，非实测立面',base_status:'CurrentTerrain采样'});
 if(b.refresh_appearance){if(useChanged||b.replace_geometry){Object.assign(P.buildingMetadata[id],{parts:b.use==='shelter'?[{block_type:'Open-sided Structure',open_canopy:true}]:[],surface_base_mPD:b.replace_geometry?undefined:P.buildingMetadata[id].surface_base_mPD,facility_code:undefined,suppress_facade_door:b.use==='shelter',suppress_facade_windows:b.use==='shelter',function_assessment:{}})}const atlas=[];const record=styledBuilding(b,atlas),m=buildingOverlay.children.at(-1);m.material.dispose();m.material=createDraftMaterial(atlas);decoratePlannedBuilding(b,m,P,T);appearanceById.set(id,record);P.buildingMetadata[id].height_m=window.buildingAppearanceRecords[id].height_m}}

 window.draftAppearance={version:d.version,records:[...appearanceById.values()]};
 timing.buildings_ms=performance.now()-buildingStart;const busStart=performance.now();
 const nextBuses=Object.fromEntries([...d.buses,...(previewPaths?.length?[{id:'preview',valid:true,name:'未提交Bus预览',paths:previewPaths}]:[])].map(b=>[b.id,b])),changedBuses=changedKeys(lastBuses,nextBuses);
 for(const [id,b] of Object.entries(nextBuses))if(pondBounds.length&&[...(b.paths||[]),...(b.stops||[]).map(s=>[s.xy])].some(c=>c.length&&pondBounds.some(p=>overlaps(bounds({coordinates:c}),p))))changedBuses.add(id);
 removeChanged(busOverlay,changedBuses);
 for(let b of Object.values(nextBuses).filter(b=>changedBuses.has(b.id)))for(let path of b.paths){let ps=path.map(p=>new T.Vector3(p[0]-O[0],p[1]-O[1],ground(p[0]-O[0],p[1]-O[1],true)+1));let m=new T.Line(new T.BufferGeometry().setFromPoints(ps),new T.LineBasicMaterial({color:'#145ccb',depthTest:false}));m.renderOrder=20;m.userData={id:b.id,reviewText:`Bus：${b.name}\n${b.headway_seconds?'班次间隔：'+b.headway_seconds+'seconds':''}\n线路来自Current路网寻路；蓝线为地面投影示意，不代表Roads高程；模型外投影HeightEstimate为0m。`};busOverlay.add(m)}
 for(let b of Object.values(nextBuses).filter(b=>changedBuses.has(b.id)))for(let s of b.stops||[]){let m=new T.Mesh(new T.SphereGeometry(1.7,8,6),new T.MeshBasicMaterial({color:'#145ccb',depthTest:false}));m.position.set(s.xy[0]-O[0],s.xy[1]-O[1],ground(s.xy[0]-O[0],s.xy[1]-O[1],true)+2);m.userData={id:b.id,reviewText:`Bus站：${s.name}\nID：${s.id}\nCurrentDraft站位；蓝球为显示符号，非站亭模型。`};busOverlay.add(m)}

 timing.buses_ms=performance.now()-busStart;
 const vegetationStart=performance.now();const vegetation=window.syncExpansionVegetation?.(d,canonicalSurfaceLayer.root);timing.vegetation_ms=performance.now()-vegetationStart;
 const enabled=document.getElementById('wire').checked;
 // Only new materials need their wireframe flag initialized; existing meshes remain untouched.
 for(const group of [buildingOverlay,pondOverlay,busOverlay,canonicalSurfaceLayer.root])for(const m of group.children)if(m.isMesh&&m.material.wireframe!==enabled)m.material.wireframe=enabled;
 lastBuildings=d.buildings;lastPonds=nextPonds;lastBuses=nextBuses;
 window.appliedDraftVersion=d.version;
 window.nativeDraft={version:d.version,ponds:Object.keys(nextPonds),buildings:Object.keys(d.buildings),roads:Object.keys(d.roads),patches:{},buses:d.buses.map(({paths,...r})=>r),buildingOverlay,busOverlay,pondOverlay,
  updated:{buildings:[...changedBuildings],ponds:[...changedPonds],buses:[...changedBuses]}};
 const invalid=d.buses.filter(b=>!b.valid);document.querySelector('#status').textContent=`Plan revision ${d.version.slice(0,12)} · synchronized with 2D${invalid.length?' · 部分Bus不可用，详见原因':''}`;
 const terrainMaterials=[...new Set(P.groups.TERRAIN.children.filter(m=>m.isMesh&&m.userData.kind==='TERRAIN').map(m=>m.material.uuid))];
 const waterMeshes=[];P.groups.TERRAIN.traverse(m=>{if(m.isMesh&&m.userData.kind==='water')waterMeshes.push(m)});
 document.querySelector('#status').dataset.appearance=JSON.stringify({version:d.version,vegetation,terrainMaterials,waterMaterials:[...new Set(waterMeshes.filter(m=>m.userData.surfaceOverlay).map(m=>m.material.uuid))],expansionWaterMeshes:waterMeshes.filter(m=>m.userData.expansion).length,waterObjects:waterMeshes.filter(m=>m.userData.expansion).map(m=>m.uuid),roadObjects:canonicalSurfaceLayer.root.children.map(m=>m.uuid),ponds:nextPonds,updatedBuildings:[...changedBuildings].map(id=>({id,appearance:window.buildingAppearanceRecords[id]||null,original:originalAppearance[id]||null})),buildingObjects:buildingOverlay.children.map(m=>[m.userData.id,m.uuid])});
 const renderStart=performance.now();P.rendering.renderNow();timing.render_submit_ms=performance.now()-renderStart;
 parent.postMessage({type:'3d-applied',version:d.version,invalidBuses:invalid,syncKey},location.origin);
}
function syncPatchLayers(){canonicalSurfaceLayer.syncVisibility()}
let appliedSyncKey=null,inFlightSyncKey=null;
async function sync(msg){
 const key=JSON.stringify([msg.name,msg.version,msg.selectedBus||null,msg.busPreview||[]]);
 if(inFlightSyncKey===key)return;
 if(inFlightSyncKey===null&&appliedSyncKey===key&&window.appliedDraftVersion===msg.version){
  parent.postMessage({type:'3d-applied',version:msg.version,syncKey:key,invalidBuses:(window.nativeDraft?.buses||[]).filter(b=>!b.valid)},location.origin);return;
 }
 if(msg.version!==window.appliedDraftVersion)document.getElementById('selection').textContent='Plan updated. Select an object to inspect current information.';
 const current=++ticket;inFlightSyncKey=key;const started=performance.now(),timing={};
 const statusNode=document.querySelector('#status'),gl=P.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');statusNode.dataset.syncBuild=new URL(import.meta.url).searchParams.get('cv')||'unversioned';statusNode.dataset.nativeModule=import.meta.url;statusNode.dataset.renderer=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
 document.querySelector('#status').textContent='Synchronizing the current 2D draft…';
 try{
  const res=await fetch('/demo/agentic-city/api/native-visual',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:msg.name,version:msg.version,selected:msg.selectedBus||null})}),d=await res.json();
  timing.fetch_native_ms=performance.now()-started;timing.server={...d.preparation_ms,request_ms:d.request_ms,cache_hit:d.cache_hit};
  if(!res.ok)throw Error(d.error);
  if(current!==ticket)return;
  statusNode.dataset.syncStage='roads';statusNode.textContent='Loading current plan road meshes…';
  const roadStart=performance.now();
  const staged=await canonicalSurfaceLayer.sync({name:msg.name,version:msg.version,network_version:d.network_version,runtime_revision:d.runtime_revision,road_tiles:d.road_tiles,ponds:d.ponds||[]});
  if(current!==ticket){staged.discard();return;}
  if(!staged.commit())return;
  timing.roads_ms=performance.now()-roadStart;timing.roads=window.canonicalRoad3D.timing;
  statusNode.dataset.syncStage='overlays-and-render';apply(d,msg.busPreview,key,timing);appliedSyncKey=key;
  timing.total_ms=performance.now()-started;
  window.lastSyncTiming={...timing,version:msg.version,updatedTiles:window.canonicalRoad3D.updatedTiles,updated:window.nativeDraft.updated};
  statusNode.dataset.syncStage='complete';statusNode.dataset.roadModule=window.canonicalRoad3D.moduleUrl;statusNode.dataset.prebuiltModule=window.canonicalRoad3D.prebuiltLoaderUrl;statusNode.dataset.syncTiming=JSON.stringify({...window.lastSyncTiming,prebuiltLoadedTiles:window.canonicalRoad3D.prebuiltLoadedTiles,generatedTiles:window.canonicalRoad3D.generatedTiles,prebuiltFallbackTiles:window.canonicalRoad3D.prebuiltFallbackTiles});
  (window.syncTimings??=[]).push(window.lastSyncTiming);if(window.syncTimings.length>100)window.syncTimings.shift();
 }catch(e){
  if(current!==ticket)return;
  appliedSyncKey=null;window.appliedDraftVersion=null;document.querySelector('#status').textContent='3D同步失败：'+e.message;
  parent.postMessage({type:'3d-error',version:msg.version,error:e.message,syncKey:key},location.origin);
 }finally{if(current===ticket)inFlightSyncKey=null;}
}
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent)return;if(e.data.type==='expanded-draft')sync(e.data);if(e.data.type==='3d-visibility'){visible=e.data.visible;P.rendering.setVisible(visible)}});
document.querySelector('.tag').textContent='V6 · 2D / 3D same plan';
document.querySelector('.note').prepend('Green buildings represent new planned geometry. Roads are grey and blue lines show bus routes. Changes, undo and reopening use the current saved plan.');
parent.postMessage({type:'3d-ready'},location.origin);

function syncWireframe(){const enabled=document.getElementById('wire').checked;P.scene.traverse(o=>{if(!o.isMesh)return;for(let m of (Array.isArray(o.material)?o.material:[o.material]))if(m&&'wireframe' in m){m.wireframe=enabled;m.needsUpdate=true}});P.rendering.renderNow()}
document.getElementById('wire').addEventListener('change',syncWireframe);syncWireframe();
const infoHost=document.getElementById('selection');new MutationObserver(()=>{if(infoHost.querySelector('a'))return;const id=infoHost.textContent.match(/(?:EXP-BLDG-|BLDG-|EXTRA-|EXCL-|PLAN-B-|FAC-|HSITP-)[\w-]+/)?.[0];if(!id)return;let a=document.createElement('a');a.href='/demo/agentic-city/building-detail.html?id='+encodeURIComponent(id)+'&draft='+encodeURIComponent(parent.editorAPI?.draft?.name||new URLSearchParams(location.search).get('draft')||'default');a.target='_blank';a.textContent='打开完整Buildings资料与历史依据';infoHost.append(document.createElement('br'),a)}).observe(infoHost,{childList:true});

function capacityDisplay(b,k){let m=b.capacity_metrics?.[k];return m?.status==='not_applicable'?'Not applicable':m?.status==='unknown'?'Unknown':b[k]??'Unknown'}

const journeyOverlay=new T.Group();P.groups.INFRASTRUCTURE.add(journeyOverlay);
let roadPointerDown=null,roadPickTicket=0;
P.renderer.domElement.addEventListener('pointerdown',e=>roadPointerDown=[e.clientX,e.clientY],true);
P.renderer.domElement.addEventListener('pointerup',async e=>{
 if(!roadPointerDown||Math.hypot(e.clientX-roadPointerDown[0],e.clientY-roadPointerDown[1])>4||!window.appliedDraftVersion)return;
 const rect=P.renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),P.camera);
 const pickables=[];function collectVisible(object){if(!object.visible)return;if(object.isMesh)pickables.push(object);for(const child of object.children)collectVisible(child);}for(const group of Object.values(P.groups))collectVisible(group);
 const hit=ray.intersectObjects(pickables,false)[0];if(!hit?.object.userData.roadSurface)return;
 const ticket=++roadPickTicket,version=window.appliedDraftVersion,name=parent.editorAPI?.draft?.name||new URLSearchParams(location.search).get('draft')||'default';
 try{
  const response=await fetch('/demo/agentic-city/api/near',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,xy:[hit.point.x+O[0],hit.point.y+O[1]]})});const rows=await response.json();if(!response.ok)throw Error(rows.error);
  if(ticket!==roadPickTicket||version!==window.appliedDraftVersion)return;
  const range=hit.object.userData.ranges.find(r=>hit.faceIndex*3>=r.start&&hit.faceIndex*3<r.end),owners=range?.road_ids||[];
  const draftResponse=await fetch('/demo/agentic-city/api/draft?name='+encodeURIComponent(name)),currentDraft=await draftResponse.json();if(currentDraft.version!==version)return;
  let row=null,road=null;
  for(const candidate of rows.filter(r=>!owners.length||owners.includes(r.id))){
   let detail=currentDraft.state.roads[candidate.id];if(!detail){const response=await fetch('/demo/agentic-city/api/road',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:candidate.id})});detail=await response.json();if(!response.ok)continue;}
   if((detail.level||0)!==(hit.object.userData.level||0))continue;row=candidate;road=detail;break;
  }
  if(!row){document.getElementById('selection').textContent='该路面暂None同层可核验的Road network关联';return;}
  if(ticket!==roadPickTicket||version!==window.appliedDraftVersion)return;
  document.getElementById('selection').textContent=JSON.stringify({道路:road.road_id||road.id,来源:road.source_ids||["planned"],交通权限:road.mode_rules,路面:road.surface_ids,版本:road.network_version},null,2);
  parent.postMessage({type:'v6-select-road',id:row.id,version},location.origin);
 }catch(error){document.getElementById('selection').textContent=error.message}
},true);
window.addEventListener('message',e=>{
 if(e.origin!==location.origin||e.source!==parent||e.data.type!=='v6-focus-road'||e.data.version!==window.appliedDraftVersion)return;
 const points=e.data.road.geometry.coordinates,xs=points.map(p=>p[0]-O[0]),ys=points.map(p=>p[1]-O[1]),x=(Math.min(...xs)+Math.max(...xs))/2,y=(Math.min(...ys)+Math.max(...ys))/2,z=ground(x,y,true),d=Math.max(40,Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))*1.4);
 P.controls.target.set(x,y,z);P.camera.position.set(x+d,y-d,z+d);P.controls.update();document.getElementById('selection').textContent='所Select road '+e.data.road.id+' · '+e.data.version;P.rendering.renderNow();
});
window.addEventListener('message',e=>{
 if(e.origin!==location.origin||e.source!==parent||e.data.type!=='road-journey'||e.data.version!==window.appliedDraftVersion)return;
 clear(journeyOverlay);
 const colors={walk:'#d14b3e',bicycle:'#458b35',car:'#3b68bd',bus:'#147878',parking:'#777'};
 for(const step of e.data.journey?.steps||[]){
  const points=(step.coordinates||[]).map(p=>new T.Vector3(p[0]-O[0],p[1]-O[1],ground(p[0]-O[0],p[1]-O[1],true)+1));
  if(points.length<2)continue;
  const geometry=new T.BufferGeometry().setFromPoints(points),line=new T.Line(geometry,new T.LineBasicMaterial({color:colors[step.kind]||'#777',depthTest:false}));
  line.userData={reviewText:'Current版本 '+step.kind+' 路线；地面投影显示，不表示测量高程',road_id:step.road_id};journeyOverlay.add(line);
 }
 journeyOverlay.userData.version=e.data.version;P.rendering.renderNow();
});
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===parent&&e.data.type==='expanded-draft'&&e.data.version!==journeyOverlay.userData.version)clear(journeyOverlay)});

window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||e.data.type!=='v6-focus-building'||e.data.version!==window.appliedDraftVersion)return;const a=window.buildingAppearanceRecords[e.data.id];if(!a)return;const [x,y,z]=a.center,d=Math.max(22,a.span*1.8);P.controls.target.set(x,y,z);P.camera.position.set(x+d,y-d*1.4,z+d);P.controls.update();P.showBuilding(e.data.id);P.rendering.renderNow()});

// standaloneCanonicalDraft: compatibility URLs consume the same current draft.
if(parent===window){const name=new URLSearchParams(location.search).get("draft")||"default";const response=await fetch("/demo/agentic-city/api/draft?name="+encodeURIComponent(name));const draft=await response.json();if(!response.ok)throw Error(draft.error);await sync({name,version:draft.version});}

// Parent selection and live capacity use the same server result as the 2D panel.
window.addEventListener('message',e=>{
 if(e.origin!==location.origin||e.source!==parent||e.data.type!=='v6-logical-detail'||e.data.version!==window.appliedDraftVersion)return;
 const d=e.data.detail;if(d.removed)return;
 const lines=['Buildings：'+(d.current.name||d.id)+' · '+d.id,'组成部件：'+d.component_ids.join('、'),'轮廓依据：'+d.geometry_source];
 const labels={residents:'Residents',jobs:'Jobs',school_places:'学位',patient_beds:'病床',care_beds:'护理床位',covered_area_m2:'覆盖面积'};
 for(const [k,label] of Object.entries(labels)){const m=d.capacity_metrics?.[k];if(m)lines.push(label+'：'+(m.status==='not_applicable'?'Not applicable':m.value)+' · '+m.source);}
 lines.push('点击、Demolish、恢复按整体操作；Capacity由组件汇总。');document.getElementById('selection').textContent=lines.join('\n');
});
