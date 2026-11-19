// Logarithmic depth keeps distant decals precise with a 1m near plane.
// Retain the previous orbit-based strategy only for before/after diagnostics.
export function configureCameraDepth(camera,controls,logarithmic=false){
 const update=()=>{
  camera.near=logarithmic?1:Math.max(1,camera.position.distanceTo(controls.target)*.02);
  camera.updateProjectionMatrix();
 };
 controls.addEventListener('change',update);
 update();
}
