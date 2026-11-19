import {indexRoadGeometry} from '/demo/agentic-city/road-index.js';
import {applySurfaceDepthBias} from '/demo/agentic-city/surface-depth.mjs';
import {prebuiltRoadLoader} from '/demo/agentic-city/prebuilt-road-loader.js';
export function surfaceLayer(T,P,O){
 const root=new T.Group();root.name='canonical-road-surfaces';P.groups.INFRASTRUCTURE.add(root);
 const prebuilt=prebuiltRoadLoader(T,P,O),active=new Map(),cache=new Map();let serial=0,manifest=null;
 function dispose(meshes){for(const m of meshes){m.geometry.dispose();m.material.dispose();root.remove(m)}}
 function syncVisibility(){for(const m of root.children)m.visible=true;P.rendering.renderNow()}
 function build(data,key,tile){
  if(data.geometry_revision!=='layer-road-mesh-v2-pond-banks')throw Error('Roads网格生成版本不匹配');
  const meshes=[];
  for(const record of data.meshes){
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(record.positions,3));
   const line=record.kind==='line',structure=record.kind==='structure';if(record.normals)geometry.setAttribute('normal',new T.Float32BufferAttribute(record.normals,3));else if(!line)geometry.computeVertexNormals();
   if(!line)indexRoadGeometry(T,geometry);
   const material=line?new T.LineBasicMaterial({color:'#deded5'}):new T.MeshStandardMaterial({color:structure?'#66645e':'#575957',roughness:.96,side:T.DoubleSide});
   if(!structure)applySurfaceDepthBias(material,line?.08:.06);
   const mesh=line?new T.LineSegments(geometry,material):new T.Mesh(geometry,material);mesh.userData={...record.userData,tile,reviewText:'Current路网路面；高程依据原Terrain与Roads连接生成，非实测部分为显示Estimate。'};mesh.receiveShadow=!line;mesh.renderOrder=structure?3:4;meshes.push(mesh);
  }
  return {key,meshes,missingHeightVertices:0,estimatedLevelVertices:0,estimatedGroundVertices:0,maximumGroundExtrapolationM:0};
 }
 async function sync(message){
  const ticket=++serial;manifest??=await fetch('/demo/agentic-city/road-tiles/manifest.json',{cache:'no-cache'}).then(r=>r.json());
  if(message.network_version!==manifest.network_version)throw Error('3D路面网络版本不匹配');
  const started=performance.now(),fetchTimes=[],buildTimes=[];let prebuiltLoaded=0,generated=0,prebuiltFallbacks=0,terrainQueries=0;
  const queue=manifest.tiles.filter(t=>active.get(t.id)?.key!==message.road_tiles[t.id].key),built=[],prepared=new Map();queue.sort((a,b)=>{const c=P.controls.target,x=c.x+O[0],y=c.y+O[1];const dist=t=>Math.hypot((t.bounds[0]+t.bounds[2])/2-x,(t.bounds[1]+t.bounds[3])/2-y);return dist(a)-dist(b)});
  async function worker(){while(queue.length){
   const tile=queue.shift(),dep=message.road_tiles[tile.id],key=dep.key+':'+tile.id,start=performance.now();
   if(!dep.edited){
    const asset=await prebuilt.load(tile,dep,message);if(ticket!==serial)return;
    if(asset){const row=prebuilt.build(asset);built.push(...row.meshes);prepared.set(tile.id,{...row,prebuilt:true});prebuiltLoaded++;if(!active.has(tile.id)){for(const mesh of row.meshes){mesh.userData.studioCommitted=true;root.add(mesh)}active.set(tile.id,prepared.get(tile.id));P.rendering.renderNow();document.querySelector('#status').dataset.firstRoadMs??=String(Math.round(performance.now()));}fetchTimes.push(performance.now()-start);continue;}
    prebuiltFallbacks++;
   }
   let data=cache.get(key);
   if(!data){const response=await fetch('/demo/agentic-city/api/road-surfaces',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:message.name,version:message.version,network_version:message.network_version,bounds:tile.bounds,lod:'near',mesh3d:true})});data=await response.json();if(!response.ok)throw Error(data.error||'Roads网格读取失败');if(data.network_version!==message.network_version)throw Error('Roads网络版本过期');cache.set(key,data);if(cache.size>manifest.tiles.length*2)cache.delete(cache.keys().next().value);}
   if(ticket!==serial)return;fetchTimes.push(performance.now()-start);const when=performance.now(),row=build(data.road_mesh,dep.key,tile.id);built.push(...row.meshes);prepared.set(tile.id,row);generated++;buildTimes.push(performance.now()-when);
  }}
  const results=await Promise.allSettled(Array.from({length:4},worker)),failure=results.find(r=>r.status==='rejected');if(failure){dispose(built.filter(m=>!m.userData.studioCommitted));throw failure.reason;}
    let consumed=false;
    function discard(){if(!consumed){consumed=true;dispose(built.filter(m=>!m.userData.studioCommitted))}}
    function commit(){
      if(consumed)return false;
      if(ticket!==serial){discard();return false;}
      consumed=true;const commitStarted=performance.now();
      for(const [id,next] of prepared){const old=active.get(id);if(old&&old!==next)dispose(old.meshes);for(const mesh of next.meshes)root.add(mesh);active.set(id,next);}
      const rows=[...active.values()],sum=k=>rows.reduce((n,r)=>n+r[k],0);
      window.canonicalRoad3D={moduleUrl:import.meta.url,prebuiltLoaderUrl:prebuilt.moduleUrl,network_version:message.network_version,runtime_revision:message.runtime_revision,version:message.version,scenario_revision:message.version,
        tiles:manifest.tiles.length,meshes:root.children.length,groundDrapeMethod:'layer-road-mesh-v2-pond-banks',terrainTriangleMaximumEdgeM:2,
        missingHeightVertices:sum('missingHeightVertices'),estimatedLevelVertices:sum('estimatedLevelVertices'),estimatedGroundVertices:sum('estimatedGroundVertices'),maximumGroundExtrapolationM:Math.max(0,...rows.map(r=>r.maximumGroundExtrapolationM)),root,
        updatedTiles:[...prepared.keys()],retainedTiles:manifest.tiles.length-prepared.size,prebuiltTiles:rows.filter(r=>r.prebuilt).length,
        prebuiltLoadedTiles:prebuiltLoaded,generatedTiles:generated,prebuiltFallbackTiles:prebuiltFallbacks,terrainQueries,
        timing:{prepare_ms:performance.now()-started,fetch_sum_ms:fetchTimes.reduce((a,b)=>a+b,0),build_sum_ms:buildTimes.reduce((a,b)=>a+b,0),commit_ms:performance.now()-commitStarted}};
      return true;
    }
    return {commit,discard,updatedTiles:[...prepared.keys()]};
  }

  return {sync,root,syncVisibility,snapshot:()=>active};
}
