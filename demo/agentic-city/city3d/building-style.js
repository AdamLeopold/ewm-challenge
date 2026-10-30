import {pilotUniforms,pilotGLSL} from './pilot-material.js?v=43';
import * as T from 'three';
import {classify,palettes,roofPalettes,styleNames} from './facade-layout.mjs?v=appearance-42';
export {styleNames};
// Surface-only rendering. Positions, triangle indices and footprint geometry are never changed.
export const buildingMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.78,flatShading:true,side:T.DoubleSide});
const uniforms={openingAtlas:{value:null},openingAtlasSize:{value:new T.Vector2(2048,1)}};
export async function initializeBuildingStyle(){const [m,b]=await Promise.all([fetch('./facade-data/manifest.json?v=foundation-38',{cache:'default'}).then(r=>{if(!r.ok)throw Error('Facade manifest missing');return r.json()}),fetch('./facade-data/openings.bin?v=foundation-38',{cache:'default'}).then(r=>{if(!r.ok)throw Error('Facade opening atlas missing');return r.arrayBuffer()})]);const texture=new T.DataTexture(new Uint8Array(b),m.width,m.height,T.RGBAFormat);texture.minFilter=texture.magFilter=T.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;uniforms.openingAtlas.value=texture;uniforms.openingAtlasSize.value.set(m.width,m.height);window.fullMapAppearance={revision:42,layoutRevision:37,total:m.total,counts:m.counts,slots:m.slots,records:m.records};return m;}
export async function loadBuildingFacades(g,tile,index){const response=await fetch(`./facade-data/${tile}-${index}.bin?v=foundation-38`,{cache:'default'});if(!response.ok)throw Error('Facade attributes missing: '+tile);const buffer=await response.arrayBuffer(),length=g.attributes.position.count*4;if(buffer.byteLength!==length*8)throw Error('Facade vertex count mismatch: '+tile);g.setAttribute('wallFrame',new T.BufferAttribute(new Float32Array(buffer,0,length),4));g.setAttribute('wallLayout',new T.BufferAttribute(new Float32Array(buffer,length*4,length),4));}
buildingMaterial.onBeforeCompile=s=>{
 Object.assign(s.uniforms,uniforms,pilotUniforms);
 s.vertexShader=s.vertexShader.replace('#include <common>',`#include <common>
 attribute vec3 roofColor;attribute vec4 facadeInfo;attribute vec4 planBounds;attribute vec4 styleDetails;attribute vec4 wallFrame;attribute vec4 wallLayout;
 varying vec3 cityRoof;varying vec3 cityPosition;varying vec3 cityNormal;
 varying vec4 facade;varying vec4 footprint;varying vec4 detail;varying vec4 faceFrame;varying vec4 faceLayout;
 `).replace('#include <begin_vertex>',`#include <begin_vertex>
 cityPosition=position;cityNormal=normal;cityRoof=roofColor;facade=facadeInfo;footprint=planBounds;detail=styleDetails;faceFrame=wallFrame;faceLayout=wallLayout;`);
 s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
 ${pilotGLSL}
 uniform sampler2D openingAtlas;uniform vec2 openingAtlasSize;
 varying vec3 cityRoof;varying vec3 cityPosition;varying vec3 cityNormal;varying vec4 facade;varying vec4 footprint;varying vec4 detail;varying vec4 faceFrame;varying vec4 faceLayout;
 float cityHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float cityNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(cityHash(i),cityHash(i+vec2(1.,0.)),f.x),mix(cityHash(i+vec2(0.,1.)),cityHash(i+vec2(1.)),f.x),f.y);}
 float cityRect(vec2 p,vec2 center,vec2 size){vec2 a=max(vec2(length(fwidth(cityPosition.xy)),fwidth(cityPosition.z)),vec2(.002));vec2 q=abs(p-center)-size*.5;vec2 v=1.-smoothstep(-a,a,q);return v.x*v.y;}
 float cityLine(float x,float pitch,float width){float d=min(mod(x,pitch),pitch-mod(x,pitch));float aa=max(fwidth(x),.001);return 1.-smoothstep(width-aa,width+aa,d);}
 `).replace('#include <color_fragment>',`#include <color_fragment>
 float p=facade.x;float industrial=1.-step(.4,abs(p-1.));float office=1.-step(.4,abs(p-3.));float retail=1.-step(.4,abs(p-4.));float civic=1.-step(.4,abs(p-5.));float shed=1.-step(.4,abs(p-6.));float service=1.-step(.4,abs(p-7.));float metal=max(industrial,shed);
 float z=max(0.,cityPosition.z-facade.y);float roof=step(.5,abs(normalize(cityNormal).z));
 mat2 align=mat2(detail.z,-detail.w,detail.w,detail.z);vec2 local=align*cityPosition.xy-footprint.xy;
 float side=abs((align*cityNormal.xy).x)>abs((align*cityNormal.xy).y)?local.y:local.x;
 float pilot=pilotWeight(cityPosition);
 float pilotHeight=0.;float recessShade=0.;
 vec3 wall=diffuseColor.rgb;
 if(pilot>0.){
 float plaster=cityNoise(vec2(side,z)*14.+facade.w*17.);
 float finishFade=1.-smoothstep(.05,.22,max(fwidth(side),fwidth(z)));
 pilotHeight=(plaster-.5)*.0012*finishFade;
 wall*=1.+pilot*(cityNoise(vec2(side*.65,z*.9))-.5)*.05;
 }

 float grain=cityHash(floor(vec2(side,z)*90.));float grainFade=1.-smoothstep(.35,1.5,max(fwidth(side*90.),fwidth(z*90.)));
 wall*=1.+(grain-.5)*mix(.035,.012,retail)*grainFade;
 wall*=mix(.79,1.,smoothstep(.38,.52,z));
 float panels=cityHash(floor(vec2(side/1.5,z/.75)));wall*=1.+(panels-.5)*(.018*civic+.012*office+.008*retail+.02*service);
 float joint=max(cityLine(side,1.5,.006),cityLine(z,.75,.006));wall*=1.-joint*(.035*civic+.025*office+.015*retail+.025*service);
 float rib=cityLine(side,.19,.012);float ribsFade=1.-smoothstep(.08,.32,fwidth(side));wall*=1.-rib*metal*.07*ribsFade;
 // Painted base and a restrained upper finish band remain flush with the wall.
 float paintedBase=1.-smoothstep(.75,.83,z);
 float upperBand=smoothstep(facade.z-.42,facade.z-.34,z);
 vec3 accent=mix(wall*.70,cityRoof,.28);
 wall=mix(wall,accent,paintedBase*.38+upperBand*.28);
 float cityGlass=0.;
 if(faceLayout.z>0.&&roof<.5){
 float cols=floor(faceFrame.w),rows=floor(fract(faceFrame.w)*1024.+.5);vec2 total=max(vec2(cols,rows),vec2(1.));vec2 panelSize=faceLayout.zw/total;
 vec2 uv=vec2(dot(cityPosition.xy,faceFrame.xy)-faceLayout.x,cityPosition.z-faceLayout.y);vec2 cell=clamp(floor(uv/panelSize),vec2(0.),total-1.);vec2 q=uv-cell*panelSize;
 float slot=faceFrame.z+cell.y*cols+cell.x;vec2 atlasUV=(vec2(mod(slot,openingAtlasSize.x),floor(slot/openingAtlasSize.x))+.5)/openingAtlasSize;vec2 allowed=texture2D(openingAtlas,atlasUV).rg;
 float w=1.5,h=1.55,cz=panelSize.y*.56;
 if(office>.5){w=max(.5,panelSize.x-.48);h=max(.6,panelSize.y-.65);}if(civic>.5){w=1.8;h=1.65;}
 if(industrial>.5){h=1.1;cz=panelSize.y*.74;}if(shed>.5){w=1.65;h=.65;cz=panelSize.y*.74;}if(service>.5){w=1.05;h=.85;cz=min(2.25,panelSize.y*.63);}if(retail>.5){w=min(2.35,panelSize.x-.55);h=2.26;cz=1.37;}
 vec2 wc=vec2(panelSize.x*.5,cz),ws=vec2(w,h);float pane=cityRect(q,wc,ws)*allowed.r;
 float border=max(0.,cityRect(q,wc,ws+vec2(.12))-cityRect(q,wc,ws))*allowed.r;
 float varied=cityHash(cell+facade.w*71.);vec3 glass=mix(vec3(.075,.11,.16),vec3(.095,.145,.205),varied*.45);glass+=vec3(.018,.025,.035)*smoothstep(0.,1.,(q.y-cz)/h+.5);
 if(pilot>0.){
 // Analytic sky tint and shallow recess shading, with no opening/geometry changes.
 float facing=1.-abs(dot(normalize(cameraPosition-cityPosition),normalize(cityNormal)));
 glass=mix(glass,vec3(.19,.27,.33),pilot*(.12+.42*pow(facing,3.)));
 float edge=1.-cityRect(q,wc,ws-vec2(.18));
 recessShade=edge*pane*.32*pilot;
 float upperShade=cityRect(q,wc+vec2(0.,h*.5-.07),vec2(w,.14))*pane;
 glass*=1.-upperShade*.28*pilot;
 pilotHeight=mix(pilotHeight,-.025,pane);
 }
 wall=mix(wall,vec3(.34,.36,.37),border);wall=mix(wall,glass,pane);
 float mullion=cityRect(q,wc,vec2(.04,h))*pane;
 if(metal<.5&&service<.5&&retail<.5)mullion=max(mullion,cityRect(q,wc-vec2(0.,h*.15),vec2(w,.035))*pane);
 wall=mix(wall,vec3(.38,.40,.41),mullion);
 float dw=industrial>.5?min(3.2,panelSize.x-.25):office>.5?min(2.6,panelSize.x-.2):civic>.5?1.7:retail>.5?1.3:1.1;float dh=industrial>.5?2.9:2.35;
 vec2 dc=vec2(panelSize.x*.5,facade.y-faceLayout.y+.08+dh*.5);float door=cityRect(q,dc,vec2(dw,dh))*allowed.g;
 float doorFrame=max(0.,cityRect(q,dc,vec2(dw+.12,dh+.10))-cityRect(q,dc,vec2(dw,dh)))*allowed.g;
 wall=mix(wall,vec3(.34,.36,.37),doorFrame);vec3 doorColor=glass*.86;if(metal>.5||service>.5)doorColor=vec3(.20,.24,.27);
 if(industrial>.5)doorColor*=1.-cityLine(z,.18,.009)*.25;
 wall=mix(wall,doorColor,door);
 if(office>.5||civic>.5){float split=cityRect(q,dc,vec2(.05,dh))*door;wall=mix(wall,vec3(.4),split);}
 float handle=cityRect(q,vec2(dc.x+dw*.3,facade.y-faceLayout.y+1.12),vec2(.026,.43))*door*(1.-industrial);wall=mix(wall,vec3(.5),handle);
 cityGlass=max(pane*(1.-mullion),door*(1.-metal)*(1.-service));
 }
 // All roof detail is shading on existing faces: no extra roof meshes or silhouette changes.
 vec3 top=cityRoof;
 float pixelSize=max(fwidth(local.x),fwidth(local.y));
 float roofFine=1.-smoothstep(.06,.28,pixelSize);
 float roofMedium=1.-smoothstep(.35,1.4,pixelSize);
 float finish=floor(facade.w*3.);
 float seamRoof=max(metal,(1.-metal)*(1.-step(.5,finish)));
 float slabRoof=(1.-metal)*(1.-step(.5,abs(finish-1.)));
 float membraneRoof=1.-seamRoof-slabRoof;
 vec2 sheets=floor(local/vec2(1.1,4.5));
 float sheetTone=cityHash(sheets+facade.w*37.)-.5;
 float standingSeam=cityLine(local.x,.55,.018);
 float sheetJoint=cityLine(local.y,4.5,.018);
 float metalDetail=(-standingSeam*.19-sheetJoint*.08)*roofFine+sheetTone*.075*roofMedium;
 vec2 slabSize=vec2(2.4,2.4);
 float slabJoint=max(cityLine(local.x,slabSize.x,.018),cityLine(local.y,slabSize.y,.018));
 float slabDetail=((cityHash(floor(local/slabSize)+facade.w*53.)-.5)*.09-slabJoint*.16)*roofMedium;
 float rollJoint=cityLine(local.x,1.25,.022);
 float rollDetail=((cityHash(vec2(floor(local.x/1.25),facade.w*21.))-.5)*.075-rollJoint*.13)*roofMedium;
 float weather=(cityNoise(local*.32+facade.w*23.)-.5)*.065;
 top*=1.+seamRoof*metalDetail+slabRoof*slabDetail+membraneRoof*rollDetail+weather;
 top*=1.+(cityHash(floor(local*35.))-.5)*.025*roofFine;
 if(pilot>0.){
 float roofRelief=-(standingSeam*.012*seamRoof+slabJoint*.018*slabRoof+rollJoint*.009*membraneRoof)*roofMedium;
 pilotHeight=mix(pilotHeight,roofRelief,roof)*pilot;
 }
 diffuseColor.rgb=mix(wall,top,roof);cityGlass*=1.-roof;
 `).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
 roughnessFactor=mix(roughnessFactor,mix(.88,.57,seamRoof),roof);
 roughnessFactor=mix(roughnessFactor,.26,cityGlass);
 if(pilot>0.){roughnessFactor=mix(roughnessFactor,mix(.91,.48,seamRoof),roof*pilot);roughnessFactor=mix(roughnessFactor,.20,cityGlass*pilot);}
 `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 if(pilot>0.){
 vec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition);
 vec3 r1=cross(dy,normal),r2=cross(normal,dx);float det=dot(dx,r1);
 vec3 gradient=sign(det)*(dFdx(pilotHeight)*r1+dFdy(pilotHeight)*r2);
 normal=normalize(max(abs(det),1e-8)*normal-gradient);
 }
 `).replace('#include <aomap_fragment>',`#include <aomap_fragment>
 if(pilot>0.){
 float baseShade=(1.-smoothstep(.08,.95,z))*.38*(1.-roof);
 float occlusion=max(baseShade*pilot,recessShade);
 reflectedLight.indirectDiffuse*=1.-occlusion;
 reflectedLight.indirectSpecular*=1.-occlusion;
 }
 `);
};
window.buildingAppearanceRecords={};
export function colorBuilding(g,r,metadata){
 const pos=g.attributes.position,colors=new Float32Array(pos.count*3),roofs=new Float32Array(pos.count*3),info=new Float32Array(pos.count*4),plans=new Float32Array(pos.count*4),details=new Float32Array(pos.count*4);
 colors.fill(.65);roofs.fill(.40);
 for(const q of r.ranges||[]){
  let hash=0;for(const ch of q.id)hash=(hash*31+ch.charCodeAt(0))>>>0;
  const item=metadata[q.id]||{},label=(item.type_label||'')+' '+(item.function_assessment?.label||'');
  const ids=new Set();for(let i=q.start*3;i<q.end*3;i++)ids.add(g.index.array[i]);
  let z=Infinity,Z=-Infinity,cx=0,cy=0;
  for(const v of ids){cx+=pos.getX(v);cy+=pos.getY(v);z=Math.min(z,pos.getZ(v));Z=Math.max(Z,pos.getZ(v));}cx/=ids.size;cy/=ids.size;
  let xx=0,yy=0,xy=0;for(const v of ids){const dx=pos.getX(v)-cx,dy=pos.getY(v)-cy;xx+=dx*dx;yy+=dy*dy;xy+=dx*dy;}
  const angle=.5*Math.atan2(2*xy,xx-yy),cs=Math.cos(angle),sn=Math.sin(angle);
  let x=Infinity,y=Infinity,X=-Infinity,Y=-Infinity;
  for(const v of ids){const u=cs*pos.getX(v)+sn*pos.getY(v),w=-sn*pos.getX(v)+cs*pos.getY(v);x=Math.min(x,u);X=Math.max(X,u);y=Math.min(y,w);Y=Math.max(Y,w);}
  const height=Z-z;
  const {profile,open}=classify(item,height);
  const industrial=profile===1,shed=profile===6,tower=profile===2;
  const palette=palettes[profile],roofPalette=roofPalettes[profile];
  const c=new T.Color(palette[hash%palette.length]),rc=new T.Color(roofPalette[(hash>>>4)%roofPalette.length]);
  const floorReference=profile===3?3.7:profile===5?3.5:3.1;
  const storey=height/Math.max(1,Math.round(height/floorReference));
  const pitch=industrial?4.8:shed?3.6:profile===3?2.1:profile===5?3.3:tower?2.7:2.6;
  window.buildingAppearanceRecords[q.id]={profile:styleNames[profile],profile_code:profile,center:[cx,cy,z+height*.5],span:Math.max(X-x,Y-y,height),height_m:height,storey_pitch_m:storey,wall_color:palette[hash%palette.length],roof_color:roofPalette[(hash>>>4)%roofPalette.length],roof_finish:industrial||shed?'彩钢立缝':['金属分缝','混凝土分格','卷材搭接'][Math.floor((hash%997)/997*3)],status:'功能与体量驱动的场景材质，非实测立面'};
  for(const v of ids){colors.set([c.r,c.g,c.b],v*3);roofs.set([rc.r,rc.g,rc.b],v*3);info.set([profile,item.surface_base_mPD??z,height,(hash%997)/997],v*4);plans.set([x,y,X-x,Y-y],v*4);details.set([Math.max(storey,1.),pitch,cs,sn],v*4);}
 }
 g.setAttribute('color',new T.BufferAttribute(colors,3));g.setAttribute('roofColor',new T.BufferAttribute(roofs,3));g.setAttribute('facadeInfo',new T.BufferAttribute(info,4));g.setAttribute('planBounds',new T.BufferAttribute(plans,4));g.setAttribute('styleDetails',new T.BufferAttribute(details,4));
}
