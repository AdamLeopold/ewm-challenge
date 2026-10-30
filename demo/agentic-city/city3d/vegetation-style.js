import * as T from 'three';
import {naturalTreeGeometry} from './natural-trees.js';
// Original tree mesh, colors and placement scale. Positions clipped and grounded to V5.
export async function loadVegetation(scene){
 const points=await (await fetch('seamless-vegetation.json')).json(),group=new T.Group(),dummy=new T.Object3D();
 group.name='V5 terrain-supported vegetation';
 for(let type=0;type<2;type++){
  const ps=points.filter(t=>t[4]===type),geo=naturalTreeGeometry(type);
  const mesh=new T.InstancedMesh(geo,new T.MeshStandardMaterial({color:'#ffffff',roughness:.96,vertexColors:true}),ps.length);
  ps.forEach((t,i)=>{dummy.position.set(...t.slice(0,3));dummy.rotation.set(0,0,i*2.399);dummy.scale.setScalar(t[3]*1.15);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new T.Color().setHSL(.22+(i%9)*.005,.15+(i%3)*.03,.64+(i%7)*.018));});
  mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
 }
 scene.add(group);window.vegetationStats={count:points.length,grounding:'V5 terrain triangle interpolation',basis:'Original tree candidates plus illustrative trees in imagery-inferred gap forests; grounded to V5 terrain'};
 return group;
}
