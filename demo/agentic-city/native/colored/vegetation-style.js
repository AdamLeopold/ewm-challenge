import * as T from 'three';
import {naturalTreeGeometry} from './natural-trees.js';
import {appearanceAssets} from './shared-appearance/assets.js';
import {planningMask} from './vegetation-planning.js';
import {terrainIndex} from '/demo/agentic-city/terrain-query.mjs';
// Original tree mesh, colors and placement scale. Positions clipped and grounded to V5.
export async function loadVegetation(scene){
 const points=await (await fetch('seamless-vegetation.json')).json(),group=new T.Group(),dummy=new T.Object3D();
 const waterMask=await fetch('./water-visual/tree-water-mask.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('水面树木过滤数据Loading failed');return r.json()});
 const waterExtra=new Set(waterMask.expansion);
 const hidden=new Set(await fetch('./facility-registration-69/blocked-tree-indices.json?v=69').then(r=>r.json()));const facilityHidden=hidden.size;for(const i of waterMask.original)hidden.add(i);group.name='V5 terrain-supported vegetation';
 // Keep original instance transforms/colours; partition by space, not by visual LOD.
 const styles=[0,1].map(type=>({geometry:naturalTreeGeometry(type),material:new T.MeshStandardMaterial({color:'#ffffff',roughness:.96,vertexColors:true})}));
 function chunks(records,parent,refs=null){
  const buckets=new Map();
  for(const r of records){const t=r.point,key=`${t[4]}:${Math.floor(t[0]/320)}:${Math.floor(t[1]/320)}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(r)}
  for(const [key,rows] of buckets){
   const style=styles[rows[0].point[4]],mesh=new T.InstancedMesh(style.geometry,style.material,rows.length);
   mesh.name='vegetation:'+key;
   rows.forEach((r,i)=>{const t=r.point;dummy.position.set(...t.slice(0,3));dummy.rotation.set(0,0,r.seed*2.399);dummy.scale.setScalar(t[3]*1.15);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new T.Color().setHSL(.22+(r.seed%9)*.005,.15+(r.seed%3)*.03,.64+(r.seed%7)*.018));if(refs)refs.set(r.id,{mesh,i,matrix:dummy.matrix.clone()})});
   // Conservative full-size bounds survive hidden trees being restored on undo.
   mesh.computeBoundingSphere();
   rows.forEach((r,i)=>{if(r.hidden){mesh.getMatrixAt(i,dummy.matrix);dummy.matrix.scale(new T.Vector3(0,0,0));mesh.setMatrixAt(i,dummy.matrix)}});
   mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);
  }
 }
 const originalRefs=new Map();let originalDraftHidden=new Set();const seeds=[0,0];chunks(points.map((point,id)=>({point,id,seed:seeds[point[4]]++,hidden:hidden.has(id)})),group,originalRefs);
 group.userData.waterTreeRemoval={original:waterMask.original.length,expansion:waterMask.expansion.length};document.getElementById('status').dataset.waterTreeRemoval=JSON.stringify(group.userData.waterTreeRemoval);
 scene.add(group);window.vegetationStats={count:points.length-hidden.size,maskedInsideRegisteredFacilities:facilityHidden,maskedOnWater:waterMask.original.length,grounding:'V5 terrain triangle interpolation',basis:'Original tree candidates plus illustrative trees in imagery-inferred gap forests; grounded to V5 terrain'};
 // Expansion instances reuse the exact old geometry, material and colour formula.
 const extra=await fetch(new URL('./shared-appearance/'+appearanceAssets.vegetation,import.meta.url)).then(r=>{if(!r.ok)throw Error('新增区域树木数据Loading failed');return r.json()});
 const refs=new Map(),expansion=new T.Group();expansion.name='Imagery-inferred expansion vegetation';group.add(expansion);
 chunks(extra.map((point,id)=>({point,id,seed:id,hidden:waterExtra.has(id)})),expansion,refs);
 let priorKey=null,hiddenExtra=new Set();const roadCache=new Map();
 window.syncExpansionVegetation=(draft,roadRoot)=>{
  const key=JSON.stringify([Object.values(draft.buildings||{}).filter(b=>b?.replace_geometry).map(b=>[b.id,b.geometry]),draft.ponds||[],draft.roads||{},roadRoot?.children.map(m=>m.uuid)||[]]);
  if(key===priorKey)return {...window.expansionVegetationStats,changed:0,cached:true};
  const originalMask=planningMask(points,draft),nextOriginal=new Set(originalMask.flatMap((v,i)=>v&&!hidden.has(i)?[i]:[]));let originalChanged=0;
  for(const id of new Set([...originalDraftHidden,...nextOriginal]))if(originalDraftHidden.has(id)!==nextOriginal.has(id)){const ref=originalRefs.get(id);dummy.matrix.copy(ref.matrix);if(nextOriginal.has(id))dummy.matrix.scale(new T.Vector3(0,0,0));ref.mesh.setMatrixAt(ref.i,dummy.matrix);ref.mesh.instanceMatrix.needsUpdate=true;originalChanged++}
  originalDraftHidden=nextOriginal;document.getElementById('status').dataset.studioTreeClearance=JSON.stringify({originalHidden:nextOriginal.size,changed:originalChanged,restored:nextOriginal.size===0});
  const masked=planningMask(extra,draft),active=new Set();
  // Cache intersections by immutable mesh UUID, including the initial baseline;
  // tile replacement/undo invalidates the affected entries, buses never touch them.
  for(const m of roadRoot?.children||[]){
   if(!m.isMesh)continue;active.add(m.uuid);let ids=roadCache.get(m.uuid);
   if(!ids){ids=[];const g=m.geometry;g.computeBoundingBox();const b=g.boundingBox,candidates=extra.map((t,i)=>i).filter(i=>{const t=extra[i],r=t[3]*2.8;return t[0]+r>=b.min.x&&t[0]-r<=b.max.x&&t[1]+r>=b.min.y&&t[1]-r<=b.max.y});
    if(candidates.length){const p=g.attributes.position,ix=g.index,n=ix?.count||p.count,tri=new Float32Array(n*3);for(let j=0;j<n;j++){const v=ix?ix.getX(j):j;tri[j*3]=p.getX(v);tri[j*3+1]=p.getY(v);tri[j*3+2]=p.getZ(v)}const query=terrainIndex(tri,16);
     for(const i of candidates){const t=extra[i],r=t[3]*2.8;if([[0,0],[r,0],[-r,0],[0,r],[0,-r]].some(([dx,dy])=>{const z=query(t[0]+dx,t[1]+dy);return z!==null&&z>=t[2]-1&&z<=t[2]+9*t[3]}))ids.push(i)}
    }roadCache.set(m.uuid,ids);
   }for(const id of ids)masked[id]=true;
  }
  for(const id of roadCache.keys())if(!active.has(id))roadCache.delete(id);
  const next=new Set([...waterExtra,...masked.flatMap((v,i)=>v?[i]:[])]);let changed=0;
  for(const id of new Set([...hiddenExtra,...next]))if(hiddenExtra.has(id)!==next.has(id)){const ref=refs.get(id);if(next.has(id)){dummy.matrix.copy(ref.matrix).scale(new T.Vector3(0,0,0));ref.mesh.setMatrixAt(ref.i,dummy.matrix)}else ref.mesh.setMatrixAt(ref.i,ref.matrix);ref.mesh.instanceMatrix.needsUpdate=true;changed++}
  hiddenExtra=next;priorKey=key;
  window.expansionVegetationStats={total:extra.length,visible:extra.length-next.size,hidden:next.size,changed,cached:false,meshIds:expansion.children.map(m=>m.uuid),basis:appearanceAssets.vegetation_basis};
  return window.expansionVegetationStats;
 };
 window.expansionVegetationStats={total:extra.length,visible:extra.length,hidden:0,meshIds:expansion.children.map(m=>m.uuid)};
 return group;
}
