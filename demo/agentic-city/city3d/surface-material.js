import * as T from 'three';

// Original loadStyledMap surfaceMaterial port. Only coordinates and V5 water/road masks adapted.
export async function surfaceMaterial(){
 const loader=new T.TextureLoader();
 const adjustment={value:1};
 window.setGroundTuning=enabled=>{adjustment.value=enabled?1:0;};
 const [albedo,cover,correction,hetaoFinish]=await Promise.all(['ground-albedo-atlas.png','grass-reviewed-cover.png','terrain-correction.png','hetao-finish.png'].map(p=>loader.loadAsync(p)));
 albedo.anisotropy=8;cover.anisotropy=8;
 const bounds=new T.Vector4(-2318,-3666,3979,7420);
function surfaceMaterial(cover){const m=new T.MeshStandardMaterial({color:'#ffffff',roughness:1,envMapIntensity:.15,side:T.DoubleSide});m.onBeforeCompile=s=>{s.uniforms.groundTuning=adjustment;s.uniforms.hetaoFinish={value:hetaoFinish};s.uniforms.terrainCorrection={value:correction};s.uniforms.surfaceBounds={value:bounds};s.uniforms.landCover={value:cover};s.uniforms.groundAlbedo={value:albedo};s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 groundPosition; varying vec3 groundNormal; varying vec2 coverUV; uniform vec4 surfaceBounds;').replace('#include <begin_vertex>','#include <begin_vertex>\ngroundPosition=position;groundNormal=normal;coverUV=(position.xy-surfaceBounds.xy)/surfaceBounds.zw;');s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 groundPosition; varying vec3 groundNormal; varying vec2 coverUV; uniform vec4 surfaceBounds;uniform sampler2D landCover;uniform sampler2D groundAlbedo;
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
float hashGround(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noiseGround(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hashGround(i),hashGround(i+vec2(1,0)),f.x),mix(hashGround(i+vec2(0,1)),hashGround(i+vec2(1,1)),f.x),f.y);}
`).replace('#include <color_fragment>',`#include <color_fragment>
float slope=1.-abs(normalize(groundNormal).z);
float grain=noiseGround(groundPosition.xy*1.8);
float macro=noiseGround(groundPosition.xy*.008);
vec3 cover=texture2D(landCover,coverUV).rgb;
vec2 texcoord=groundPosition.xy/7.;
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
vec4 fix=texture2D(terrainCorrection,coverUV);
// Imagery-guided material corrections: grass/shrub, woodland, dry grass and hardstanding.

vec3 pavingPhoto=materialSample(texcoord,vec2(.5,0.));
float pavingDetail=clamp(dot(pavingPhoto,vec3(.2126,.7152,.0722))/.24,.78,1.20);
vec3 hardstanding=pow(vec3(.43,.46,.47),vec3(2.2))*pavingDetail;
base=mix(base,mix(meadow,shrub,smoothstep(.15,.65,fix.g)),fix.r);
base=mix(base,woodland,fix.g);
base=mix(base,dryMeadow,fix.b*.90);
base=mix(base,hardstanding,smoothstep(.08,.55,fix.a));
// Local hardstanding finish: neutral gray, warm muted soil, subdued real texture.
vec2 finish=texture2D(hetaoFinish,coverUV).rg;
float softDetail=1.+(pavingDetail-1.)*.22;
vec3 localPaving=pow(vec3(.49,.485,.465),vec3(2.2))*softDetail;
float soilDetail=clamp(dot(dirt,vec3(.2126,.7152,.0722))/.26,.8,1.2);
vec3 localSoil=pow(vec3(.53,.49,.425),vec3(2.2))*(1.+(soilDetail-1.)*.25);
vec3 localFinish=mix(localSoil,localPaving,smoothstep(.10,.50,finish.g));
base=mix(base,localFinish,finish.r*.94);
// Exact draped vector surfaces now provide roads, markings and water.
diffuseColor.rgb=base;

`);};return m;}
 window.surfaceInfo={style:'Shared vegetation palette across original and corrected terrain',geometrySource:'../aligned_data/',ponds:371};
 return surfaceMaterial(cover);
}

export function roadDisplayMaterial(){return new T.MeshStandardMaterial({color:'#575957',roughness:.96,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4});}
