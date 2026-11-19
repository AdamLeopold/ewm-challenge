import * as T from 'three';
// Opt-in visual QA only; never edits or saves a planning draft.
export function installTerrainReview(preview){
 if(!new URLSearchParams(location.search).has('terrainReview'))return;
 const {camera,controls,groups,scene,renderer,manifest}=preview;
 const panel=document.createElement('div');panel.id='terrain-review';panel.style.cssText='position:fixed;left:12px;top:12px;z-index:100;background:#fff;padding:10px;max-width:620px;font:13px sans-serif;color:#172c29';
 document.querySelector('aside').style.display='none';document.querySelector('header').style.display='none';
 const min=[Infinity,Infinity],max=[-Infinity,-Infinity];for(const t of manifest.tiles)for(let k=0;k<2;k++){min[k]=Math.min(min[k],t.min[k]);max[k]=Math.max(max[k],t.max[k]);}
 let cell=0,top=false,low=false,water=true,exposed=false,custom=null;
 const cols=4,rows=5,dx=(max[0]-min[0])/cols,dy=(max[1]-min[1])/rows,span=Math.max(dx,dy)*1.65;
 const label=document.createElement('div');label.id='review-state';
 const update=()=>{label.dataset.ready="0";const x=custom?custom[0]:min[0]+dx*(cell%cols+.5),y=custom?custom[1]:min[1]+dy*(Math.floor(cell/cols)+.5),distance=custom?custom[2]:span;controls.target.set(x,y,low?8:15);camera.position.set(x+(top?0:distance*.35),y-(top?.001:distance*.65),(low?8:15)+distance*(top?1.6:low?.12:1.15));controls.update();groups.TERRAIN.traverse(m=>{if(m.isMesh&&m.userData.waterVisualFile)m.visible=water;});groups.BUILDING.visible=!exposed;groups.INFRASTRUCTURE.visible=!exposed;label.textContent=`分区 ${cell+1}/20 · ${top?'俯视':'斜视'} · ${water?'有水':'None水'} · ${exposed?'裸地':'BuildingsRoads可见'} · 共享接边Terrain · ${x.toFixed(0)},${y.toFixed(0)}`;window.preview.rendering.renderNow();requestAnimationFrame(()=>requestAnimationFrame(()=>{label.dataset.ready="1";}));};
 const button=(id,text,fn)=>{const b=document.createElement('button');b.id=id;b.textContent=text;b.onclick=()=>{fn();update();};panel.append(b);};
 for(let i=0;i<20;i++)button('review-cell-'+i,String(i+1),()=>{cell=i;custom=null;});
 panel.append(document.createElement('br'));
 button('review-oblique','斜视',()=>{top=false;low=false});button('review-top','俯视',()=>{top=true;low=false});button('review-low','低角度',()=>{top=false;low=true});button('review-water','切换水面',()=>water=!water);button('review-exposed','切换BuildingsRoads',()=>exposed=!exposed);
 panel.append(document.createElement('br'));const fields=[];for(const [id,value] of [['x',220],['y',2291],['span',100]]){const input=document.createElement('input');input.id='review-'+id;input.type='number';input.value=value;input.style.width='70px';input.setAttribute('aria-label',id);panel.append(input);fields.push(input);}button('review-focus','定位近景',()=>custom=fields.map(f=>Number(f.value)));
 panel.append(document.createElement('br'));
 const originalMaterials=new Map();let inspectMode=0;
 button('review-lighting','对照：正常光照',()=>{
  inspectMode=(inspectMode+1)%3;
  groups.TERRAIN.traverse(m=>{if(!m.isMesh||m.userData.kind!=='TERRAIN')return;
   if(!originalMaterials.has(m))originalMaterials.set(m,m.material);
   const source=originalMaterials.get(m);if(m.material!==source)m.material.dispose();
   if(inspectMode===0){m.material=source;return;}
   if(inspectMode===2){m.material=new T.MeshBasicMaterial({color:'#829775',side:T.DoubleSide});return;}
   const material=source.clone();material.onBeforeCompile=function(shader,renderer){source.onBeforeCompile.call(this,shader,renderer);shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight = diffuseColor.rgb;\n#include <opaque_fragment>');};material.customProgramCacheKey=()=> 'terrain-review-unlit';m.material=material;
  });
  document.querySelector('#review-lighting').textContent=['对照：正常光照','对照：None光照纹理','对照：None光照纯色'][inspectMode];
 });
 panel.append(label);document.body.append(panel);update();
}
