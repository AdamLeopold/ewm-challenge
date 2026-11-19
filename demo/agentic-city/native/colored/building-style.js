import {sharedBuildingAppearance} from './shared-appearance/building-palette.js';
import * as T from 'three';
import {roofFrame as deriveRoofFrame} from './roof-rules.mjs';
let pilotRecords={},roofFrames={};
const alignRoofs=true;
const pilotActive=true;
import {classify,palettes,roofPalettes,styleNames} from './facade-layout.mjs?v=building-one-door-96';
export {styleNames};
// Surface-only rendering. Positions, triangle indices and footprint geometry are never changed.
export const buildingMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.78,flatShading:true,side:T.DoubleSide});
const uniforms={openingAtlas:{value:null},openingAtlasSize:{value:new T.Vector2(2048,1)}};
export async function initializeBuildingStyle(){roofFrames=await fetch("./roof-alignment-62/frames.json?v=62").then(r=>{if(!r.ok)throw Error("Roof alignment data missing");return r.json()});pilotRecords=await fetch('./material-colour-60/overrides.json?v=60').then(r=>{if(!r.ok)throw Error('Building colour palette missing');return r.json()});const [m,b]=await Promise.all([fetch('./entity-facades/manifest.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Facade manifest missing');return r.json()}),fetch('./entity-facades/openings.bin',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Facade opening atlas missing');return r.arrayBuffer()})]);Object.assign(pilotRecords,await fetch('./facility-registration-69/overrides.json?v=building-one-door-96').then(r=>r.json()));Object.assign(roofFrames,await fetch('./entity-facades/roof-frames.json').then(r=>r.json()));const texture=new T.DataTexture(new Uint8Array(b),m.width,m.height,T.RGBAFormat);texture.minFilter=texture.magFilter=T.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;uniforms.openingAtlas.value=texture;uniforms.openingAtlasSize.value.set(m.width,m.height);window.fullMapAppearance={revision:42,layoutRevision:37,total:m.total,counts:m.counts,slots:m.slots,records:m.records};return m;}
export async function loadBuildingFacades(g,tile,index){const extra=true,response=await fetch(`./entity-facades/${tile}-${index}.bin`,{cache:'no-store'});if(!response.ok)throw Error('Facade attributes missing: '+tile);const buffer=await response.arrayBuffer(),length=g.attributes.position.count*4;if(buffer.byteLength!==length*8+(extra?length:0))throw Error('Facade vertex count mismatch: '+tile);g.setAttribute('wallFrame',new T.BufferAttribute(new Float32Array(buffer,0,length),4));g.setAttribute('wallLayout',new T.BufferAttribute(new Float32Array(buffer,length*4,length),4));if(extra)g.setAttribute('facilitySurface',new T.BufferAttribute(new Float32Array(buffer,length*8,g.attributes.position.count),1));}

buildingMaterial.onBeforeCompile=s=>{
 Object.assign(s.uniforms,uniforms);
 s.vertexShader=s.vertexShader.replace('#include <common>',`#include <common>
 attribute float facilitySurface;varying float facilitySurfaceRole;attribute vec4 roofFrame;attribute vec2 roofSpan;varying vec4 cityRoofFrame;varying vec2 cityRoofSpan;attribute vec2 materialPilot;attribute vec3 roofColor;attribute vec4 facadeInfo;attribute vec4 planBounds;attribute vec4 styleDetails;attribute vec4 wallFrame;attribute vec4 wallLayout;
 varying vec2 pilotMaterial;varying vec3 cityRoof;varying vec3 cityPosition;varying vec3 cityNormal;
 varying vec4 facade;varying vec4 footprint;varying vec4 detail;varying vec4 faceFrame;varying vec4 faceLayout;
 `).replace('#include <begin_vertex>',`#include <begin_vertex>
 facilitySurfaceRole=facilitySurface;cityRoofFrame=roofFrame;cityRoofSpan=roofSpan;pilotMaterial=materialPilot;cityPosition=position;cityNormal=normal;cityRoof=roofColor;facade=facadeInfo;footprint=planBounds;detail=styleDetails;faceFrame=wallFrame;faceLayout=wallLayout;`);
 s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
 varying float facilitySurfaceRole;varying vec4 cityRoofFrame;varying vec2 cityRoofSpan;uniform sampler2D openingAtlas;uniform vec2 openingAtlasSize;
 varying vec2 pilotMaterial;varying vec3 cityRoof;varying vec3 cityPosition;varying vec3 cityNormal;varying vec4 facade;varying vec4 footprint;varying vec4 detail;varying vec4 faceFrame;varying vec4 faceLayout;
 float cityHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float cityNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(cityHash(i),cityHash(i+vec2(1.,0.)),f.x),mix(cityHash(i+vec2(0.,1.)),cityHash(i+vec2(1.)),f.x),f.y);}
 float cityRect(vec2 p,vec2 center,vec2 size){vec2 a=max(vec2(length(fwidth(cityPosition.xy)),fwidth(cityPosition.z)),vec2(.002));vec2 q=abs(p-center)-size*.5;vec2 v=1.-smoothstep(-a,a,q);return v.x*v.y;}
 float cityLine(float x,float pitch,float width){float d=min(mod(x,pitch),pitch-mod(x,pitch));float aa=max(fwidth(x),.001);return 1.-smoothstep(width-aa,width+aa,d);}
 `).replace('#include <color_fragment>',`#include <color_fragment>
 float pilot=pilotMaterial.x;float p=facade.x;float industrial=1.-step(.4,abs(p-1.));float office=1.-step(.4,abs(p-3.));float retail=1.-step(.4,abs(p-4.));float civic=1.-step(.4,abs(p-5.));float shed=1.-step(.4,abs(p-6.));float service=1.-step(.4,abs(p-7.));float metal=max(industrial,shed);
 float z=max(0.,cityPosition.z-facade.y);float roof=step(.5,abs(normalize(cityNormal).z));
 mat2 align=mat2(detail.z,-detail.w,detail.w,detail.z);vec2 local=align*cityPosition.xy-footprint.xy;
 float side=abs((align*cityNormal.xy).x)>abs((align*cityNormal.xy).y)?local.y:local.x;
 vec3 facilityBase=diffuseColor.rgb;vec3 wall=diffuseColor.rgb;
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
 if(pilot>.5){
 // Flush finishes only; preserve every opening and the original mesh.
 float coarse=cityNoise(vec2(side*.17,z*.23)+facade.w*17.);
 wall*=.97+coarse*.06;
 float tile=max(cityLine(side,.30,.003),cityLine(z,.15,.003));
 float tileFade=1.-smoothstep(.035,.14,max(fwidth(side),fwidth(z)));
 wall*=1.-tile*tileFade*.07*(1.-metal)*(1.-office);
 float band=cityLine(z,detail.x,.045)*(1.-metal);
 wall*=1.-band*.07;
 float rain=cityNoise(vec2(side*2.,z*.09));
 wall*=1.-rain*.035*(1.-smoothstep(0.,1.1,z));
 }
 // Opening clearance must include opaque doors; glass is only a material mask.
 float cityGlass=0.;float cityOpeningKeepout=0.;float cityDoorBay=0.;
 if(faceLayout.z>0.&&roof<.5){
 float cols=floor(faceFrame.w),rows=floor(fract(faceFrame.w)*1024.+.5);vec2 total=max(vec2(cols,rows),vec2(1.));vec2 panelSize=faceLayout.zw/total;
 vec2 uv=vec2(dot(cityPosition.xy,faceFrame.xy)-faceLayout.x,cityPosition.z-faceLayout.y);vec2 cell=clamp(floor(uv/panelSize),vec2(0.),total-1.);vec2 q=uv-cell*panelSize;
 float slot=faceFrame.z+cell.y*cols+cell.x;vec2 atlasUV=(vec2(mod(slot,openingAtlasSize.x),floor(slot/openingAtlasSize.x))+.5)/openingAtlasSize;vec3 allowed=texture2D(openingAtlas,atlasUV).rgb;
 cityDoorBay=allowed.g;
 float w=1.5,h=1.55,cz=panelSize.y*.56;
 if(office>.5){w=max(.5,panelSize.x-.48);h=max(.6,panelSize.y-.65);}if(civic>.5){w=1.8;h=1.65;}
 if(industrial>.5){h=1.1;cz=panelSize.y*.74;}if(shed>.5){w=1.65;h=.65;cz=panelSize.y*.74;}if(service>.5){w=1.05;h=.85;cz=min(2.25,panelSize.y*.63);}if(retail>.5){w=min(2.35,panelSize.x-.55);h=2.26;cz=1.37;}
 if(detail.y<0.){w=min(2.3,panelSize.x*.55);h=min(1.8,panelSize.y*.5);}
 vec2 wc=vec2(panelSize.x*.5,cz),ws=vec2(w,h);float pane=cityRect(q,wc,ws)*allowed.r;
 float border=max(0.,cityRect(q,wc,ws+vec2(.12))-cityRect(q,wc,ws))*allowed.r;
 float varied=cityHash(cell+facade.w*71.);vec3 glass=mix(vec3(.075,.11,.16),vec3(.095,.145,.205),varied*.45);glass+=vec3(.018,.025,.035)*smoothstep(0.,1.,(q.y-cz)/h+.5);
 if(pilot>.5){
 float sky=smoothstep(-.5,.5,(q.y-cz)/h);
 glass=mix(vec3(.095,.13,.15),vec3(.23,.29,.32),sky);
 glass*=.90+.18*cityHash(vec2(cell.x,floor(cell.y/2.))+facade.w*71.);
 float recess=max(0.,cityRect(q,wc,ws+vec2(.25))-cityRect(q,wc,ws+vec2(.12)))*allowed.r;
 wall*=1.-recess*.20;
 }
 vec3 frameTone=mix(vec3(.34,.36,.37),vec3(.43,.45,.44),pilot);
 wall=mix(wall,frameTone,border);wall=mix(wall,glass,pane);
 float mullion=cityRect(q,wc,vec2(.04,h))*pane;
 if(metal<.5&&service<.5&&retail<.5)mullion=max(mullion,cityRect(q,wc-vec2(0.,h*.15),vec2(w,.035))*pane);
 wall=mix(wall,vec3(.38,.40,.41),mullion);
 float dw=facilitySurfaceRole>14.5?min(3.2,panelSize.x-.25):industrial>.5?min(3.2,panelSize.x-.25):office>.5?min(2.6,panelSize.x-.2):civic>.5?1.7:retail>.5?1.3:1.1;float dh=industrial>.5?2.9:2.35;
 vec2 dc=vec2(panelSize.x*.5,facade.y-faceLayout.y+.08+allowed.b*12.75+dh*.5);float door=cityRect(q,dc,vec2(dw,dh))*allowed.g;
 cityOpeningKeepout=max(cityRect(q,wc,ws+vec2(.24))*allowed.r,cityRect(q,dc,vec2(dw+.24,dh+.22))*allowed.g);
 float doorFrame=max(0.,cityRect(q,dc,vec2(dw+.12,dh+.10))-cityRect(q,dc,vec2(dw,dh)))*allowed.g;
 wall=mix(wall,vec3(.34,.36,.37),doorFrame);vec3 doorColor=glass*.86;if(metal>.5||service>.5||facilitySurfaceRole>13.5)doorColor=vec3(.20,.24,.27);
 if(industrial>.5||facilitySurfaceRole>14.5)doorColor*=1.-cityLine(z,.18,.009)*.25;
 wall=mix(wall,doorColor,door);
 if(office>.5||civic>.5){float split=cityRect(q,dc,vec2(.05,dh))*door;wall=mix(wall,vec3(.4),split);}
 float handle=cityRect(q,vec2(dc.x+dw*.3,facade.y-faceLayout.y+1.12+allowed.b*12.75),vec2(.026,.43))*door*(1.-industrial);wall=mix(wall,vec3(.5),handle);
 cityGlass=max(pane*(1.-mullion),door*(1.-metal)*(1.-service));
 }
 // All roof detail is shading on existing faces: no extra roof meshes or silhouette changes.
 local=mat2(cityRoofFrame.z,-cityRoofFrame.w,cityRoofFrame.w,cityRoofFrame.z)*cityPosition.xy-cityRoofFrame.xy;
 vec3 top=cityRoof;
 float pixelSize=max(fwidth(local.x),fwidth(local.y));
 float roofFine=1.-smoothstep(.06,.28,pixelSize);
 float roofMedium=1.-smoothstep(.35,1.4,pixelSize);
 float finish=mix(floor(facade.w*3.),pilotMaterial.y,pilot);
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
 if(pilot>.5){
 float broad=cityNoise(local*.12+facade.w*31.);
 top*=.95+.10*broad;
 float edgeDist=min(min(local.x,cityRoofSpan.x-local.x),min(local.y,cityRoofSpan.y-local.y));
 top*=1.-(1.-smoothstep(0.,.45,max(0.,edgeDist)))*.085;
 float ribShape=sin(local.x*6.283185/.28);
 top*=1.+ribShape*.035*roofFine*seamRoof;
 }
 diffuseColor.rgb=mix(wall,top,roof);cityGlass*=1.-roof;
 if(facilitySurfaceRole>.5&&facilitySurfaceRole<1.5){diffuseColor.rgb=vec3(.105,.23,.25)*( .95+.06*cityNoise(cityPosition.xy*.6));}
 // Reservoir-only surface tags: no effect on other building materials.
 if(facilitySurfaceRole>1.5&&facilitySurfaceRole<2.5){
 float broadGrass=cityNoise(local*.075+vec2(13.,7.));
 float patches=(.55*cityNoise(local*.7+vec2(2.,19.))+.30*cityNoise(local*2.3)+.15*cityNoise(local*7.));
 float flecks=cityNoise(local*2.8);
 vec3 turf=mix(vec3(.090,.123,.052),vec3(.135,.166,.072),smoothstep(.2,.85,broadGrass));
 turf=mix(turf,vec3(.215,.173,.103),smoothstep(.34,.78,patches)*.28);
 turf*=.91+.14*flecks;
 turf*=.96+.07*cityNoise(local*14.);
 float margin=min(min(local.x,cityRoofSpan.x-local.x),min(local.y,cityRoofSpan.y-local.y));
 turf*=mix(.78,1.,smoothstep(.35,1.4,margin));
 diffuseColor.rgb=turf;
 }
 if(facilitySurfaceRole>2.5){
 vec3 concrete=facilitySurfaceRole<3.5?vec3(.235,.228,.183):vec3(.23,.24,.20);
 concrete*=.91+.16*cityNoise(local*.9)+.05*cityNoise(local*8.);
 if(facilitySurfaceRole>3.5){concrete*=1.-.13*cityLine(side,3.2,.018);concrete*=.77+.23*smoothstep(0.,.4,z);}
 diffuseColor.rgb=concrete;
 }

 if(facilitySurfaceRole>15.5){diffuseColor.rgb=vec3(.38,.39,.36)*(.96+.05*cityNoise(local*3.));cityGlass=0.;}
 // Type-specific facility materials replace residential roof seams and facade panels.
 if(facilitySurfaceRole>4.5&&facilitySurfaceRole<5.5){
 diffuseColor.rgb=mix(facilityBase,cityRoof,roof)*(.96+.055*cityNoise(cityPosition.xy*2.));cityGlass=0.;
 }
 if(facilitySurfaceRole>5.5&&facilitySurfaceRole<6.5){
 vec3 steel=mix(vec3(.34,.39,.40),cityRoof,.35);
 float bands=cityLine(z,.7,.015)*(1.-roof);diffuseColor.rgb=steel*(.97+.035*cityNoise(local*3.)-.12*bands);cityGlass=0.;
 }
 if(facilitySurfaceRole>6.5&&facilitySurfaceRole<7.5){diffuseColor.rgb=vec3(.095,.12,.125)*(.94+.08*cityNoise(local*5.));cityGlass=0.;}
 if(facilitySurfaceRole>7.5&&facilitySurfaceRole<8.5){
 float tiles=max(cityLine(local.x,.24,.015),cityLine(local.y+floor(local.x/.24)*.18,.36,.012));
 diffuseColor.rgb=cityRoof*(1.-tiles*.16*roofMedium);cityGlass=0.;
 }
 if(facilitySurfaceRole>8.5&&facilitySurfaceRole<9.5){diffuseColor.rgb=vec3(.23,.30,.27)*(.96+.06*cityNoise(local*4.));cityGlass=0.;}
 if(facilitySurfaceRole>9.5&&facilitySurfaceRole<10.5){diffuseColor.rgb=vec3(.40,.29,.17);cityGlass=0.;}
 if(facilitySurfaceRole>10.5&&facilitySurfaceRole<11.5){
 float slots=cityLine(local.x,.22,.075);diffuseColor.rgb=mix(vec3(.045,.06,.06),vec3(.21,.25,.24),slots);cityGlass=0.;
 }
 if(facilitySurfaceRole>11.5&&facilitySurfaceRole<12.5){
 vec2 d=abs(local-cityRoofSpan*.5);vec2 q1=abs(local-cityRoofSpan*vec2(.33,.5));vec2 q2=abs(local-cityRoofSpan*vec2(.67,.5));
 float hatch=1.-smoothstep(.27,.30,min(max(q1.x,q1.y),max(q2.x,q2.y)));
 diffuseColor.rgb=mix(vec3(.29,.30,.265)*(.95+.06*cityNoise(local*4.)),vec3(.10,.115,.11),hatch*roof);cityGlass=0.;
 }
 if(facilitySurfaceRole>12.5&&facilitySurfaceRole<13.5){diffuseColor.rgb=vec3(.25,.17,.085)*(.96+.06*cityNoise(vec2(side*10.,z*.8)));cityGlass=0.;}
 if(facilitySurfaceRole>13.5&&facilitySurfaceRole<15.5){
 // Each wall uses its own measured face frame; panels stop before corners.
 float faceWidth=faceLayout.z;
 float bays=max(1.,floor(faceFrame.w));float pitch=faceWidth/bays;
 float along=dot(cityPosition.xy,faceFrame.xy)-faceLayout.x;
 float bayCenter=(floor(clamp(along,0.,max(0.,faceWidth-.001))/max(pitch,.001))+.5)*pitch;
 float panelWidth=min(2.2,max(0.,pitch-.70));
 vec2 panelPoint=vec2(along,z),panelCenter=vec2(bayCenter,1.645);
 float usable=step(.55,panelWidth)*step(.9,faceWidth)*(1.-cityDoorBay)*(1.-cityOpeningKeepout);
 float outer=cityRect(panelPoint,panelCenter,vec2(panelWidth,.79))*usable;
 float inner=cityRect(panelPoint,panelCenter,vec2(max(.01,panelWidth-.10),.69))*usable;
 float slats=cityLine(z-1.3,.10,.025);
 vec3 louvers=mix(vec3(.055,.08,.075),vec3(.19,.23,.21),slats);
 diffuseColor.rgb=mix(wall,vec3(.28,.30,.27),outer);
 diffuseColor.rgb=mix(diffuseColor.rgb,louvers,inner*.9);
 }
 `).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
 roughnessFactor=mix(roughnessFactor,mix(.88,.57,seamRoof),roof);
 roughnessFactor=mix(roughnessFactor,mix(.26,.34,pilot),cityGlass);
 if(facilitySurfaceRole>1.5){roughnessFactor=.96;} if(facilitySurfaceRole>5.5&&facilitySurfaceRole<7.5){roughnessFactor=.48;} if(facilitySurfaceRole>9.5&&facilitySurfaceRole<10.5){roughnessFactor=.34;}`);
};
window.buildingAppearanceRecords={};
export function colorBuilding(g,r,metadata,options={}){
 g.setAttribute('facilitySurface',new T.BufferAttribute(new Float32Array(g.attributes.position.count),1));
 const pos=g.attributes.position,colors=new Float32Array(pos.count*3),roofs=new Float32Array(pos.count*3),info=new Float32Array(pos.count*4),plans=new Float32Array(pos.count*4),details=new Float32Array(pos.count*4);
 const pilotData=new Float32Array(pos.count*2),roofFrameData=new Float32Array(pos.count*4),roofSpanData=new Float32Array(pos.count*2);
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
  const rf=options.regenerate?deriveRoofFrame(pos.array,g.index.array,q):alignRoofs&&roofFrames[q.id]?roofFrames[q.id]:[x,y,cs,sn,X-x,Y-y];
  const height=Z-(item.surface_base_mPD??z);
  const {profile,open}=classify(item,item.appearance_use?Z-(item.surface_base_mPD??z):height);
  const industrial=profile===1,shed=profile===6,tower=profile===2;
  const palette=palettes[profile],roofPalette=roofPalettes[profile];
  const entry=pilotActive?(options.regenerate||item.expansion?sharedBuildingAppearance(profile,hash,q.id,cx,cy):(pilotRecords[q.id]||sharedBuildingAppearance(profile,hash,q.id,cx,cy))):null;const c=new T.Color(entry?.wall||palette[hash%palette.length]),rc=new T.Color(entry?.roof||roofPalette[(hash>>>4)%roofPalette.length]);
  const floorReference=profile===3?3.7:profile===5?3.5:3.1;
  const storey=height/Math.max(1,Math.round(height/floorReference));
  const pitch=q.id==='BLDG-288787'?-5:industrial?4.8:shed?3.6:profile===3?2.1:profile===5?3.3:tower?2.7:2.6;
  window.buildingAppearanceRecords[q.id]={profile:styleNames[profile],profile_code:profile,center:[cx,cy,z+height*.5],span:Math.max(X-x,Y-y,height),height_m:height,storey_pitch_m:storey,wall_color:entry?.wall||palette[hash%palette.length],roof_color:entry?.roof||roofPalette[(hash>>>4)%roofPalette.length],material_pilot:entry||null,roof_finish:industrial||shed?'彩钢立缝':['金属分缝','混凝土分格','卷材搭接'][Math.floor((hash%997)/997*3)],status:'Function与体量驱动的场景材质，非实测立面'};
  for(const v of ids){roofFrameData.set(rf.slice(0,4),v*4);roofSpanData.set(rf.slice(4,6),v*2);pilotData.set([entry?1:0,entry?.finish??1],v*2);colors.set([c.r,c.g,c.b],v*3);roofs.set([rc.r,rc.g,rc.b],v*3);info.set([profile,item.surface_base_mPD??z,height,(hash%997)/997],v*4);plans.set([x,y,X-x,Y-y],v*4);details.set([Math.max(storey,1.),pitch,cs,sn],v*4);}
 }
 g.setAttribute('roofFrame',new T.BufferAttribute(roofFrameData,4));g.setAttribute('roofSpan',new T.BufferAttribute(roofSpanData,2));g.setAttribute('materialPilot',new T.BufferAttribute(pilotData,2));g.setAttribute('color',new T.BufferAttribute(colors,3));g.setAttribute('roofColor',new T.BufferAttribute(roofs,3));g.setAttribute('facadeInfo',new T.BufferAttribute(info,4));g.setAttribute('planBounds',new T.BufferAttribute(plans,4));g.setAttribute('styleDetails',new T.BufferAttribute(details,4));
}

// Own atlas per edit batch; reuses the original shader without changing baseline uniforms.
export function createDraftMaterial(atlas){
 const width=2048,height=Math.max(1,Math.ceil(atlas.length/4/width)),bytes=new Uint8Array(width*height*4);bytes.set(atlas);
 const texture=new T.DataTexture(bytes,width,height,T.RGBAFormat);texture.minFilter=texture.magFilter=T.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
 const material=buildingMaterial.clone();material.onBeforeCompile=s=>{buildingMaterial.onBeforeCompile(s);s.uniforms.openingAtlas={value:texture};s.uniforms.openingAtlasSize={value:new T.Vector2(width,height)}};material.customProgramCacheKey=()=> 'draft-original-facade-r5';material.addEventListener('dispose',()=>texture.dispose());return material;
}
