import {initializePilot,addPilotContact} from './pilot-material.js?v=43';
import {buildingMaterial,colorBuilding,initializeBuildingStyle,loadBuildingFacades} from './building-style.js?v=pilot-43';
import {loadVegetation} from './vegetation-style.js';
import {surfaceMaterial,roadDisplayMaterial} from './surface-material.js?v=appearance-42';
import * as T from 'three';
import {loadReviewedCrossings} from './reviewed-crossings.js?v=41';
import {loadVectorSurfaces} from './vector-surfaces.js?v=appearance-42';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const $=id=>document.getElementById(id),scene=new T.Scene();scene.background=new T.Color('#bfc9c8');
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;$('canvas').append(renderer.domElement);
const camera=new T.PerspectiveCamera(42,innerWidth/innerHeight,1,60000);camera.up.set(0,0,1);const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=15;controls.maxDistance=24000;controls.maxPolarAngle=Math.PI*.495;scene.add(new T.HemisphereLight('#f3f5ff','#c5c1bb',1.65));const light=new T.DirectionalLight('#fffaf4',2.6);light.position.set(-3000,-4500,8000);scene.add(light);light.castShadow=true;light.shadow.mapSize.set(4096,4096);Object.assign(light.shadow.camera,{left:-1600,right:1600,top:1600,bottom:-1600,near:1,far:16000});light.shadow.normalBias=1.6;light.shadow.bias=-.0006;scene.add(light.target);controls.addEventListener('change',()=>{const d=camera.position.distanceTo(controls.target);light.shadow.camera.left=light.shadow.camera.bottom=-Math.min(2500,Math.max(300,d*.6));light.shadow.camera.right=light.shadow.camera.top=-light.shadow.camera.left;light.shadow.camera.updateProjectionMatrix();light.target.position.copy(controls.target);light.position.copy(controls.target).add(new T.Vector3(-3000,-4500,8000));});
const kinds=['BUILDING','TERRAIN','INFRASTRUCTURE','OTHER'],groups={},materials={};kinds.forEach((k,i)=>{groups[k]=new T.Group();scene.add(groups[k]);materials[k]=new T.MeshStandardMaterial({color:['#ece7da','#6a7851','#696b68','#b2b1a5'][i],roughness:.95,side:T.DoubleSide});if($(k))$(k).onchange=e=>groups[k].visible=e.target.checked;});$('wire').onchange=e=>[buildingMaterial,...Object.values(materials)].forEach(m=>m.wireframe=e.target.checked);
// Resolve nearly coplanar road/terrain surfaces in the depth buffer only.
// Keep depth testing/writing: bridges still occlude correctly and roads cannot
// draw through buildings. No vertices or real-world elevations are moved.
materials.INFRASTRUCTURE.polygonOffset=true;
materials.INFRASTRUCTURE.polygonOffsetFactor=-2;
materials.INFRASTRUCTURE.polygonOffsetUnits=-4;
materials.INFRASTRUCTURE.depthTest=true;
materials.INFRASTRUCTURE.depthWrite=true;

let buildingMetadata={},appearance={};
await initializePilot();
await initializeBuildingStyle();
// Same V5 geometry; land-cover material is projected in HK1980.
materials.TERRAIN=await surfaceMaterial();
addPilotContact(materials.TERRAIN);
materials.INFRASTRUCTURE=roadDisplayMaterial();
addPilotContact(materials.INFRASTRUCTURE);
$('ground-tuning').onchange=e=>window.setGroundTuning(e.target.checked);
const vegetation=await loadVegetation(scene);
$('LANDSCAPE').onchange=e=>vegetation.visible=e.target.checked;

let bounds,center,manifest,loaded=0,count=0,triangles=0;const failures=[];
function frame(c,span,top=false){controls.target.copy(c);camera.position.copy(c).add(top?new T.Vector3(0,-.001,span*1.1):new T.Vector3(span*.55,-span*.85,span*.95));controls.update();}
$('all').onclick=()=>frame(center,Math.max(bounds.getSize(new T.Vector3()).x,bounds.getSize(new T.Vector3()).y));$('top').onclick=()=>frame(controls.target.clone(),Math.max(camera.position.distanceTo(controls.target)*.75,300),true);
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{const p=new T.Vector3(...({north:[100,2700,10],middle:[-421,214,15],south:[548,-2047,45],slopes:[-700,-2850,90],architecture:[50,100,18],highway:[-950,-200,10],water:[216,2349,2]}[b.dataset.view]));frame(p,({architecture:250,highway:220,water:350}[b.dataset.view]||1100))});
function focusStyle(code){
 const candidates=Object.entries(window.buildingAppearanceRecords||{}).filter(([id,r])=>r.profile_code===code&&r.height_m>3&&r.span<150);
 const targetHeight=code===0?9:code===1?9:code===3?22:12;
 candidates.sort((a,b)=>Math.abs(a[1].height_m-targetHeight)+Math.abs(a[1].span-22)*.15-(Math.abs(b[1].height_m-targetHeight)+Math.abs(b[1].span-22)*.15));
 if(!candidates.length)return;
 const [id,r]=candidates[0];frame(new T.Vector3(...r.center),Math.max(65,r.span*2.4));showBuilding(id);
}
document.querySelectorAll('[data-style]').forEach(b=>b.onclick=()=>focusStyle(Number(b.dataset.style)));
window.focusBuildingStyle=focusStyle;
document.querySelectorAll('.buttons button:not([data-pilot])').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.buttons button:not([data-pilot])').forEach(x=>x.classList.toggle('active',x===b))}));
const ray=new T.Raycaster(),mouse=new T.Vector2();let down;
function hit(e){mouse.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);ray.setFromCamera(mouse,camera);return ray.intersectObjects(Object.values(groups).filter(g=>g.visible),true)[0]}
renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4)return;const h=hit(e);if(!h)return;const r=h.object.userData;if(r.reviewText){$('selection').textContent='Reviewed surface connection';return;}const range=r.ranges?.find(x=>h.faceIndex>=x.start&&h.faceIndex<x.end);if(range){showBuilding(range.id);return;}if(!r.min){$('selection').textContent='Ground and roads · Surface materials and vegetation';return;}$('selection').textContent=`${r.kind} surface\nElevation: ${r.min[2].toFixed(2)}—${r.max[2].toFixed(2)} m\nGeometry height: ${(r.max[2]-r.min[2]).toFixed(2)} m`;});renderer.domElement.addEventListener('dblclick',e=>{const h=hit(e);if(h)frame(h.point.clone(),Math.min(700,camera.position.distanceTo(controls.target)*.5))});addEventListener('keydown',e=>{if(e.key==='Home')$('all').click()});
$('shot').onclick=()=>{renderer.render(scene,camera);const a=document.createElement('a');a.download='3d-natural-color.png';a.href=renderer.domElement.toDataURL('image/png');a.click()};addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
renderer.setAnimationLoop(()=>{controls.update();$('north').style.transform=`rotate(${controls.getAzimuthalAngle()}rad)`;renderer.render(scene,camera)});
async function get(url,type='json'){const versioned=new URL(url,location.href);versioned.searchParams.set('modelRevision','appearance-42');const r=await fetch(versioned,{cache:'no-store'});if(!r.ok)throw Error(`${url}: ${r.status}`);return r[type]()}

try{manifest=await get('../aligned_data/scene.json');buildingMetadata=await get('../aligned_data/buildings_metadata.json');bounds=new T.Box3();manifest.tiles.forEach(t=>{bounds.expandByPoint(new T.Vector3(...t.min));bounds.expandByPoint(new T.Vector3(...t.max))});center=bounds.getCenter(new T.Vector3());$('all').click();const queue=[...manifest.tiles];await Promise.all([0,1,2].map(async()=>{while(queue.length){const t=queue.shift();try{const [rs,buf]=await Promise.all([get(`../aligned_data/${t.id}.json`),get(`../aligned_data/${t.id}.bin`,'arrayBuffer')]);for(const [recordIndex,r] of rs.entries()){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(buf,r.position_offset,r.vertex_count*3),3));g.setIndex(new T.BufferAttribute(new Uint32Array(buf,r.index_offset,r.index_count),1));g.computeVertexNormals();g.computeBoundingSphere();const k=groups[r.kind]?r.kind:'OTHER';if(k==='BUILDING'){colorBuilding(g,r,buildingMetadata);await loadBuildingFacades(g,t.id,recordIndex);}const m=new T.Mesh(g,k==='BUILDING'?buildingMaterial:materials[k]);m.castShadow=k==='BUILDING';m.receiveShadow=true;m.userData=r;m.renderOrder=k==='INFRASTRUCTURE'?1:0;groups[k].add(m);count++;triangles+=r.index_count/3}}catch(e){failures.push(t.id);console.error(e)}loaded++;$('progress').style.width=loaded/manifest.tiles.length*100+'%';$('status').textContent=`Loading city ${Math.round(loaded/manifest.tiles.length*100)}%`}}));const vectorSurfaces=await loadVectorSurfaces(groups);addPilotContact(vectorSurfaces.materials.road);await loadReviewedCrossings(groups);$('all').click();const requestedView=new URLSearchParams(location.search).get('view');if(['middle','north','south','slopes','architecture','highway','water'].includes(requestedView))document.querySelector('[data-view='+requestedView+']').click();if(requestedView==='crossing'){const c=window.reviewedCrossingInfo.center_local;controls.target.set(...c);camera.position.set(c[0]-38,c[1]-35,c[2]+32);controls.update();$('selection').textContent=window.reviewedCrossingInfo.reviewText;}window.preview={buildingMetadata,showBuilding,scene,camera,renderer,controls,groups,manifest,count,triangles,failures,ready:true};const styleParam=new URLSearchParams(location.search).get('style');if(styleParam!==null)focusStyle(Number(styleParam));const buildingParam=new URLSearchParams(location.search).get('building');if(buildingParam&&window.buildingAppearanceRecords[buildingParam]){const b=window.buildingAppearanceRecords[buildingParam];frame(new T.Vector3(...b.center),Math.max(90,b.span*2.4));showBuilding(buildingParam);}}catch(e){$('status').textContent='Unable to load: '+e.message;console.error(e)}

function showBuilding(id){const p=buildingMetadata[id];if(!p)return;document.getElementById('selection').textContent=id+' | Height '+Number(p.height_m).toFixed(1)+' m';parent.postMessage({type:'city-building-selected',id},location.origin);}

import './planning-bridge.js';
