import {appearanceAssets} from './shared-appearance/assets.js';
import {applySurfaceDepthBias} from './surface-depth.js?v=53';
import * as T from 'three';
const revision='surfaces-indexed-v2';
export async function loadVectorSurfaces(groups){
 const response=await fetch(`./water-visual/manifest.json?v=${revision}`,{cache:'no-store'});if(!response.ok)throw Error('Vector surface manifest missing');const manifest=await response.json();window.waterVisualManifest=manifest;
 // Slope-scaled offsets can pull ground decals in front of low roofs.
 // The shared depth module applies bounded metre offsets, including log depth.
 const make=(color,order)=>new T.MeshStandardMaterial({color,roughness:.96,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:0,polygonOffsetUnits:-order});
 const materials={road:make('#575957',6),water:make('#416769',4),markings:make('#deded5',9)};
 materials.water.roughness=.6;
 materials.water.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 waterXY;').replace('#include <begin_vertex>','#include <begin_vertex>\nwaterXY=position.xy;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 waterXY;').replace('#include <color_fragment>',`#include <color_fragment>
float variation=sin(waterXY.x*.023+waterXY.y*.017)*sin(waterXY.y*.019);diffuseColor.rgb*=1.+variation*.025;`);};
 materials.markings.transparent=true;materials.markings.depthWrite=false;
 materials.markings.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
diffuseColor.a*=1.-smoothstep(350.,1100.,length(vViewPosition));`);};
 for(const [kind,m] of Object.entries(materials))applySurfaceDepthBias(m,{water:.04,road:.06,markings:.08}[kind]);
 const surfaceGroups={};for(const k of ['TERRAIN','INFRASTRUCTURE']){surfaceGroups[k]=new T.Group();surfaceGroups[k].name='vector-surfaces-'+k;groups[k].add(surfaceGroups[k]);}
 const queue=[...manifest.files];await Promise.all(Array.from({length:6},async()=>{while(queue.length){const r=queue.shift();const res=await fetch(r.expansion?new URL('./shared-appearance/'+r.file,import.meta.url).href:`./water-visual/${r.file}?v=${revision}`,{cache:'no-store'});if(!res.ok)throw Error('Vector surface missing '+r.file);const b=await res.arrayBuffer();if(r.format!==2||b.byteLength!==r.bytes||r.index_offset!==r.vertices*12||r.index_offset+r.index_count*4!==b.byteLength)throw Error('Invalid indexed water surface '+r.file);const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(b,0,r.vertices*3),3));g.setIndex(new T.BufferAttribute(new Uint32Array(b,r.index_offset,r.index_count),1));const normals=new Float32Array(r.vertices*3);for(let i=2;i<normals.length;i+=3)normals[i]=1;g.setAttribute('normal',new T.BufferAttribute(normals,3));g.computeBoundingSphere();const mesh=new T.Mesh(g,materials[r.kind]);mesh.receiveShadow=true;mesh.renderOrder=r.kind==='markings'?5:r.kind==='road'?4:3;mesh.userData={surfaceOverlay:true,kind:r.kind,waterVisualFile:r.file,visualSurfaceOnly:true,expansion:false,waterRanges:r.ranges||[],originalWaterIndices:g.index.array.slice(),entitiesVersion:manifest.version};surfaceGroups[r.kind==='road'||r.kind==='markings'?'INFRASTRUCTURE':'TERRAIN'].add(mesh);}}));
 window.vectorSurfaceInfo={revision,expansionWaterFiles:0,entitiesVersion:manifest.version,triangles:manifest.triangles,dash_count:manifest.dash_count,files:manifest.files.length,source_meshes_modified:false};return {groups:surfaceGroups,materials};
}
