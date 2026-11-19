import * as T from 'three';
// Fit the shadow to the visible portion of the entire scene volume. A caster
// outside the view can still cast into it: matching light-space XY is retained.
export function configureSunShadow(light,camera,controls){
 light.shadow.mapSize.set(4096,4096);
 Object.assign(light.shadow.camera,{near:1,far:40000});
 light.shadow.normalBias=0;
 const sceneBounds=new T.Box3(new T.Vector3(-10000,-10000,-100),new T.Vector3(10000,10000,1000));
 const frustum=new T.Frustum(),matrix=new T.Matrix4(),sunOffset=new T.Vector3(-3000,-4500,8000).normalize().multiplyScalar(20000);
 const faces=[[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]];
 function clip(poly,plane){
  const out=[];
  for(let i=0;i<poly.length;i++){
   const a=poly[i],b=poly[(i+1)%poly.length],da=plane.distanceToPoint(a),db=plane.distanceToPoint(b);
   if(da>=0)out.push(a);
   if((da>=0)!==(db>=0))out.push(a.clone().lerp(b,da/(da-db)));
  }
  return out;
 }
 const update=()=>{
  camera.updateMatrixWorld();
  frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  // Clip both polyhedra's edges/faces: camera frustum corners inside the scene
  // and scene faces intersecting the frustum are both needed for a complete fit.
  const corners=Array.from({length:8},(_,i)=>new T.Vector3(i&1?sceneBounds.max.x:sceneBounds.min.x,i&2?sceneBounds.max.y:sceneBounds.min.y,i&4?sceneBounds.max.z:sceneBounds.min.z));
  const points=[];
  for(const face of faces){let poly=face.map(i=>corners[i]);for(const plane of frustum.planes)poly=clip(poly,plane);points.push(...poly);}
  const viewCorners=Array.from({length:8},(_,i)=>new T.Vector3(i&1?1:-1,i&2?1:-1,i&4?1:-1).unproject(camera));
  const boxPlanes=[new T.Plane(new T.Vector3(1,0,0),-sceneBounds.min.x),new T.Plane(new T.Vector3(-1,0,0),sceneBounds.max.x),new T.Plane(new T.Vector3(0,1,0),-sceneBounds.min.y),new T.Plane(new T.Vector3(0,-1,0),sceneBounds.max.y),new T.Plane(new T.Vector3(0,0,1),-sceneBounds.min.z),new T.Plane(new T.Vector3(0,0,-1),sceneBounds.max.z)];
  for(const face of faces){let poly=face.map(i=>viewCorners[i]);for(const plane of boxPlanes)poly=clip(poly,plane);points.push(...poly);}
  light.target.position.copy(sceneBounds.getCenter(new T.Vector3()));
  light.position.copy(light.target.position).add(sunOffset);
  light.updateMatrixWorld();light.target.updateMatrixWorld();light.shadow.updateMatrices(light);
  const c=light.shadow.camera,fit=new T.Box3();
  for(const p of points)fit.expandByPoint(p.clone().applyMatrix4(c.matrixWorldInverse));
  if(fit.isEmpty())for(const p of corners)fit.expandByPoint(p.clone().applyMatrix4(c.matrixWorldInverse));
  const width=Math.max(180,fit.max.x-fit.min.x+24),height=Math.max(180,fit.max.y-fit.min.y+24);
  const tx=width/4096,ty=height/4096,cx=Math.round((fit.min.x+fit.max.x)/2/tx)*tx,cy=Math.round((fit.min.y+fit.max.y)/2/ty)*ty;
  c.left=cx-width/2;c.right=cx+width/2;c.bottom=cy-height/2;c.top=cy+height/2;c.updateProjectionMatrix();
  const texel=Math.max(tx,ty),depthOffset=Math.min(3.2,Math.max(.65,texel*2.5));
  light.shadow.bias=-depthOffset/(c.far-c.near);
  window.shadowReview={revision:45,texelMetres:texel,depthOffsetMetres:depthOffset,normalBias:0,fitPoints:points.length,coverage:points.every(p=>{const q=p.clone().applyMatrix4(c.matrixWorldInverse);return q.x>=c.left&&q.x<=c.right&&q.y>=c.bottom&&q.y<=c.top&&-q.z>=c.near&&-q.z<=c.far;})};
 };
 controls.addEventListener('change',update);
 addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();update();});
 update();
 return {setBounds(bounds){sceneBounds.copy(bounds).expandByScalar(60);update();}};
}
