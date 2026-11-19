// One frame scheduler for orbit damping, asynchronous loading and editor changes.
// Camera changes retain the existing shadow fit; only unchanged frames are skipped.
export function createDemandRenderer(renderer,scene,camera,controls,north){
 let pending=0,dirty=true,visible=true;
 renderer.shadowMap.autoUpdate=false;
 function active(){return visible&&!document.hidden}
 function invalidate(shadows=false){
  dirty=true;if(shadows)renderer.shadowMap.needsUpdate=true;
  if(active()&&!pending)pending=requestAnimationFrame(tick);
 }
 function draw(){dirty=false;north.style.transform=`rotate(${controls.getAzimuthalAngle()}rad)`;renderer.render(scene,camera)}
 function tick(){pending=0;if(!active())return;controls.update();if(dirty)draw()}
 function renderNow(shadows=true){dirty=true;if(shadows)renderer.shadowMap.needsUpdate=true;if(active())draw()}
 function setVisible(value){visible=value;if(!active()&&pending){cancelAnimationFrame(pending);pending=0}if(active())invalidate()}
 controls.addEventListener('change',()=>invalidate(true));
 controls.addEventListener('start',()=>invalidate());
 controls.addEventListener('end',()=>invalidate());
 document.addEventListener('visibilitychange',()=>setVisible(visible));
 // A layer/material change can leave camera and controls untouched.
 document.addEventListener('change',()=>invalidate(true));
 addEventListener('resize',()=>invalidate(true));
 invalidate(true);
 return {invalidate,renderNow,setVisible};
}
