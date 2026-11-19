import {appearanceAssets} from './shared-appearance/assets.js';
import {applySurfaceDepthBias} from './surface-depth.js?v=53';
import * as T from 'three';

// Original loadStyledMap surfaceMaterial port. Only coordinates and V5 water/road masks adapted.
export async function surfaceMaterial(){
 const loader=new T.TextureLoader();
 const adjustment={value:1};
 window.setGroundTuning=enabled=>{adjustment.value=enabled?1:0;};
 const coverFile='grass-reviewed-cover-seams-51.png';
 const [albedo,cover,correction,hetaoFinish]=await Promise.all(['ground-albedo-atlas.png',coverFile,'terrain-correction.png','hetao-finish.png'].map(p=>loader.loadAsync(p)));
 albedo.anisotropy=8;cover.anisotropy=8;
 const bounds=new T.Vector4(-2318,-3666,3979,7420);
 const expansionCover=await loader.loadAsync(new URL('./shared-appearance/'+appearanceAssets.cover,import.meta.url).href);
 expansionCover.anisotropy=8;
 const expansionCorrection=await loader.loadAsync(new URL('./shared-appearance/'+appearanceAssets.correction,import.meta.url).href);
 const gardenContextMap=await loader.loadAsync(new URL('./shared-appearance/'+appearanceAssets.garden_context,import.meta.url).href);
 const expansionBounds=new T.Vector4(...appearanceAssets.bounds);
function terrainVariant(cover,expansion){const m=new T.MeshStandardMaterial({color:'#ffffff',roughness:1,envMapIntensity:.15,side:T.DoubleSide});m.defines={CITY_TERRAIN_EXPANSION:expansion?1:0};m.defaultAttributeValues={...m.defaultAttributeValues,terrainExpansion:[0]};m.onBeforeCompile=s=>{s.uniforms.gardenContextMap={value:gardenContextMap};s.uniforms.expansionCover={value:expansionCover};s.uniforms.expansionCorrection={value:expansionCorrection};s.uniforms.expansionBounds={value:expansionBounds};s.uniforms.groundTuning=adjustment;s.uniforms.hetaoFinish={value:hetaoFinish};s.uniforms.terrainCorrection={value:correction};s.uniforms.surfaceBounds={value:bounds};s.uniforms.landCover={value:cover};s.uniforms.groundAlbedo={value:albedo};s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 groundPosition; varying vec3 groundNormal; varying vec2 coverUV; uniform vec4 surfaceBounds; attribute float terrainExpansion; varying float expansionRegion; varying vec2 expansionUV; uniform vec4 expansionBounds;').replace('#include <begin_vertex>','#include <begin_vertex>\nexpansionRegion=terrainExpansion;expansionUV=(position.xy-expansionBounds.xy)/expansionBounds.zw;groundPosition=position;groundNormal=normal;coverUV=(position.xy-surfaceBounds.xy)/surfaceBounds.zw;');s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 groundPosition; varying vec3 groundNormal; varying vec2 coverUV; uniform vec4 surfaceBounds;uniform sampler2D landCover;uniform sampler2D groundAlbedo;
const float expansionRegion=float(CITY_TERRAIN_EXPANSION); varying vec2 expansionUV; uniform sampler2D expansionCover;uniform sampler2D expansionCorrection;uniform sampler2D gardenContextMap;
uniform float groundTuning;uniform sampler2D terrainCorrection;uniform sampler2D hetaoFinish;
// Grade the existing photograph samples; preserve texture coordinates and detail.
vec3 materialSample(vec2 p,vec2 origin){
 vec2 q=fract(p);
 vec3 raw=pow(textureGrad(groundAlbedo,origin+vec2(.01)+q*.48,dFdx(p)*.48,dFdy(p)*.48).rgb,vec3(2.2));
 bool plant=origin.y>.25, leaf=plant&&origin.x>.25;
 float lum=dot(raw,vec3(.2126,.7152,.0722));
 float saturation=plant?(leaf?.78:.84):(origin.x>.25?.68:.84);
 vec3 c=mix(vec3(lum),raw,saturation);
 vec3 balance=plant?(leaf?vec3(.88,.98,1.12):vec3(.78,.94,1.10)):(origin.x>.25?vec3(.94,.98,1.04):vec3(.94,.97,1.035));
 c*=balance;
 float pivot=plant?.095:.26;
 c=mix(vec3(pivot)*balance,c,plant?.68:.70);
 return mix(raw,max(c,vec3(0.)),groundTuning);
}
float hetaoInterior(vec2 p){
 p=(p-vec2(133.948,2851.696))/1.16+vec2(133.948,2851.696);
 bool inside=false; float edge=10000.;
 {vec2 a=vec2(143.533,3617.348),b=vec2(772.388,3170.287); vec2 ab=b-a; edge=min(edge,length(p-a-ab*clamp(dot(p-a,ab)/dot(ab,ab),0.,1.))); if((a.y>p.y)!=(b.y>p.y)){if(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}}
 {vec2 a=vec2(772.388,3170.287),b=vec2(789.952,3013.339); vec2 ab=b-a; edge=min(edge,length(p-a-ab*clamp(dot(p-a,ab)/dot(ab,ab),0.,1.))); if((a.y>p.y)!=(b.y>p.y)){if(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}}
 {vec2 a=vec2(789.952,3013.339),b=vec2(485.049,2605.265); vec2 ab=b-a; edge=min(edge,length(p-a-ab*clamp(dot(p-a,ab)/dot(ab,ab),0.,1.))); if((a.y>p.y)!=(b.y>p.y)){if(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}}
 {vec2 a=vec2(485.049,2605.265),b=vec2(-111.216,2298.352); vec2 ab=b-a; edge=min(edge,length(p-a-ab*clamp(dot(p-a,ab)/dot(ab,ab),0.,1.))); if((a.y>p.y)!=(b.y>p.y)){if(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}}
 {vec2 a=vec2(-111.216,2298.352),b=vec2(-320.922,2331.421); vec2 ab=b-a; edge=min(edge,length(p-a-ab*clamp(dot(p-a,ab)/dot(ab,ab),0.,1.))); if((a.y>p.y)!=(b.y>p.y)){if(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}}
 {vec2 a=vec2(-320.922,2331.421),b=vec2(-376.015,2474.136); vec2 ab=b-a; edge=min(edge,length(p-a-ab*clamp(dot(p-a,ab)/dot(ab,ab),0.,1.))); if((a.y>p.y)!=(b.y>p.y)){if(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}}
 {vec2 a=vec2(-376.015,2474.136),b=vec2(-166.051,2825.191); vec2 ab=b-a; edge=min(edge,length(p-a-ab*clamp(dot(p-a,ab)/dot(ab,ab),0.,1.))); if((a.y>p.y)!=(b.y>p.y)){if(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}}
 {vec2 a=vec2(-166.051,2825.191),b=vec2(-11.183,3329.921); vec2 ab=b-a; edge=min(edge,length(p-a-ab*clamp(dot(p-a,ab)/dot(ab,ab),0.,1.))); if((a.y>p.y)!=(b.y>p.y)){if(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}}
 {vec2 a=vec2(-11.183,3329.921),b=vec2(143.533,3617.348); vec2 ab=b-a; edge=min(edge,length(p-a-ab*clamp(dot(p-a,ab)/dot(ab,ab),0.,1.))); if((a.y>p.y)!=(b.y>p.y)){if(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}}
return inside?smoothstep(0.,18.,edge):0.;}
float hashGround(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noiseGround(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hashGround(i),hashGround(i+vec2(1,0)),f.x),mix(hashGround(i+vec2(0,1)),hashGround(i+vec2(1,1)),f.x),f.y);}
`).replace('#include <color_fragment>',`#include <color_fragment>
float slope=1.-abs(normalize(groundNormal).z);
float grain=noiseGround(groundPosition.xy*1.8);
float macro=noiseGround(groundPosition.xy*.008);
vec3 cover=mix(texture2D(landCover,coverUV).rgb,texture2D(expansionCover,expansionUV).rgb,expansionRegion);
vec3 gn=abs(normalize(groundNormal));
vec2 upright=gn.x>gn.y?groundPosition.yz:groundPosition.xz;
vec2 texcoord=mix(groundPosition.xy,upright,1.-smoothstep(.08,.30,gn.z))/7.;
vec3 grass=mix(materialSample(texcoord,vec2(0.,.5)),materialSample(mat2(.8,.6,-.6,.8)*texcoord*.73+vec2(13.7,7.2),vec2(0.,.5)),.5);
vec3 litter=materialSample(texcoord*.7,vec2(.5,.5));
vec3 dirt=materialSample(texcoord,vec2(0.,0.));
// One vegetation palette for original coverage and imagery-corrected areas.
vec3 woodland=mix(grass*vec3(.75,.90,.68),litter*.65,.30);
// Retain the approved deep palette; use restrained luminance steps only.
vec3 meadow=woodland*1.25;
vec3 shrub=woodland*1.12;
vec3 dryMeadow=grass*vec3(1.35,1.12,.73)+vec3(.025,.018,.006);
vec3 base=mix(dirt*.9,meadow,smoothstep(.015,.27,cover.r));
float woody=smoothstep(.10,.43,cover.b);
vec3 woodyMaterial=mix(shrub,woodland,smoothstep(.28,.85,woody));
base=mix(base,woodyMaterial,woody*.72);
base=mix(base,dirt,smoothstep(.2,.65,cover.g)*.8);
base*=.92+.12*noiseGround(groundPosition.xy*.17)+.07*macro;
vec4 fix=mix(texture2D(terrainCorrection,coverUV),texture2D(expansionCorrection,expansionUV),expansionRegion);
// Imagery-guided material corrections: grass/shrub, woodland, dry grass and hardstanding.

vec3 pavingPhoto=materialSample(texcoord,vec2(.5,0.));
float pavingDetail=clamp(dot(pavingPhoto,vec3(.2126,.7152,.0722))/.24,.78,1.20);
vec3 hardstanding=pow(vec3(.43,.46,.47),vec3(2.2))*pavingDetail;
base=mix(base,mix(meadow,shrub,smoothstep(.15,.65,fix.g)),fix.r);
base=mix(base,woodland,fix.g);
base=mix(base,dryMeadow,fix.b*.90);
base=mix(base,hardstanding,smoothstep(.08,.55,fix.a));
// Reuse the surrounding terrain's actual soil/meadow materials without a local palette.
// Aerial vegetation coverage controls placement; nonvegetated ground uses soil, not gray paving.
vec2 finish=texture2D(hetaoFinish,coverUV).rg*(1.-expansionRegion);
float island=max(hetaoInterior(groundPosition.xy),smoothstep(.0,.80,finish.r))*(1.-expansionRegion);
// Roughly 32 m coverage suppresses individual roofs/tracks while preserving green parcels.
// Apply the reviewed old soil/meadow blend to expansion gardens too.
// Match the old 32 m landscape blend in open land; retain 8 m garden evidence
// only in built land. Blend scales continuously, without a zoning boundary.
float gardenContext=texture2D(gardenContextMap,expansionUV).r;
vec4 broadExpansion=textureLod(expansionCorrection,expansionUV,5.);
float gardenEvidence=textureLod(expansionCorrection,expansionUV,3.).r;
float landscapeGrass=smoothstep(.025,.38,broadExpansion.r);
float gardenGrass=smoothstep(.035,.18,gardenEvidence);
float oldGrass=smoothstep(.035,.18,textureLod(terrainCorrection,coverUV,5.).r);
float imageGrass=mix(oldGrass,mix(landscapeGrass,gardenGrass,gardenContext),expansionRegion);
// Same soil photo as elsewhere, sampled in three directions to avoid large-area repetition.
vec3 sharedSoil=(dirt+materialSample(mat2(.8,.6,-.6,.8)*texcoord*.73+vec2(13.7,7.2),vec2(0.,0.))+materialSample(mat2(.36,-.93,.93,.36)*texcoord*1.19+vec2(6.1,23.8),vec2(0.,0.)))/3.;
vec3 sharedGround=mix(sharedSoil*.9,meadow,imageGrass);
sharedGround*=.92+.12*noiseGround(groundPosition.xy*.17)+.07*macro;
base=mix(base,sharedGround,island);
vec4 expansionFinish=mix(broadExpansion,fix,gardenContext);
vec3 expansionGround=mix(sharedGround,woodland,expansionFinish.g);
expansionGround=mix(expansionGround,dryMeadow,expansionFinish.b*.90);
base=mix(base,expansionGround,expansionRegion);
// Exact draped vector surfaces now provide roads, markings and water.
diffuseColor.rgb=base;

`).replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
// Suppress survey-face lighting creases on the local level platform only.
float levelFinish=max(hetaoInterior(groundPosition.xy),smoothstep(.0,.80,texture2D(hetaoFinish,coverUV).r))*(1.-expansionRegion);
vec3 levelNormal=normalize(mat3(viewMatrix)*vec3(0.,0.,1.));
normal=normalize(mix(normal,levelNormal,levelFinish));
`);};return m;}
 window.surfaceInfo={style:'Shared vegetation palette across original and corrected terrain',geometrySource:'/demo/agentic-city/aligned_data/',ponds:371};
 return {original:terrainVariant(cover,false),expansion:terrainVariant(cover,true)};
}

export function roadDisplayMaterial(){return applySurfaceDepthBias(new T.MeshStandardMaterial({color:'#575957',roughness:.96,side:T.DoubleSide}),.02);}
