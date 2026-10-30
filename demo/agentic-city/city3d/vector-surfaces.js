import * as T from 'three';
import {loadPack,runQueue} from './loading.js?v=web-1';
const revision='roads-water-40';
export async function loadVectorSurfaces(groups,{packs,info,onProgress=()=>{}}={}){
 const manifest=info;

 const make=(color,order)=>new T.MeshStandardMaterial({color,roughness:.96,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-order,polygonOffsetUnits:-order*2});
 const materials={road:make('#575957',6),water:make('#416769',4),markings:make('#deded5',9)};
 materials.water.roughness=.6;
 materials.water.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 waterXY;').replace('#include <begin_vertex>','#include <begin_vertex>\nwaterXY=position.xy;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 waterXY;').replace('#include <color_fragment>',`#include <color_fragment>
float variation=sin(waterXY.x*.023+waterXY.y*.017)*sin(waterXY.y*.019);diffuseColor.rgb*=1.+variation*.025;`);};
 materials.markings.transparent=true;materials.markings.depthWrite=false;
 materials.markings.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
diffuseColor.a*=1.-smoothstep(350.,1100.,length(vViewPosition));`);};
 const surfaceGroups={};for(const k of ['TERRAIN','INFRASTRUCTURE']){surfaceGroups[k]=new T.Group();surfaceGroups[k].name='vector-surfaces-'+k;groups[k].add(surfaceGroups[k]);}
 const consume=async(r,b,offset)=>{if(r.length!==r.vertices*12)throw Error('Invalid vector surface '+r.file);const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(b,offset,r.vertices*3),3));const pos=g.attributes.position;for(let i=0;i<pos.count;i+=3){const ax=pos.getX(i+1)-pos.getX(i),ay=pos.getY(i+1)-pos.getY(i),bx=pos.getX(i+2)-pos.getX(i),by=pos.getY(i+2)-pos.getY(i);if(ax*by-ay*bx<0){const x=pos.getX(i+1),y=pos.getY(i+1),z=pos.getZ(i+1);pos.setXYZ(i+1,pos.getX(i+2),pos.getY(i+2),pos.getZ(i+2));pos.setXYZ(i+2,x,y,z);}}g.computeVertexNormals();if(r.kind==='water'){const n=g.attributes.normal;for(let i=0;i<n.count;i++)n.setXYZ(i,0,0,1);}g.computeBoundingSphere();const mesh=new T.Mesh(g,materials[r.kind]);mesh.receiveShadow=true;mesh.renderOrder=r.kind==='markings'?5:r.kind==='road'?4:3;mesh.userData={surfaceOverlay:true,kind:r.kind};surfaceGroups[r.group].add(mesh);onProgress();};
 await runQueue(packs,pack=>loadPack(pack,consume),{concurrency:3});
 window.vectorSurfaceInfo={revision,triangles:manifest.triangles,dash_count:manifest.dash_count,files:packs.reduce((n,p)=>n+p.entries.length,0),source_meshes_modified:false};return {groups:surfaceGroups,materials};
}
