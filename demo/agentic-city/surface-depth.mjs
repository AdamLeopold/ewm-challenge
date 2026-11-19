// Separate coincident surfaces by a bounded camera-space distance, not a
// slope/depth-buffer-unit bias that grows into metres at oblique/far views.
// Only clip-space depth changes: XY coverage, source vertices and shadows stay.
export function applySurfaceDepthBias(material,metres){
 const previous=material.onBeforeCompile;
 material.polygonOffset=false;
 material.onBeforeCompile=function(shader,renderer){
  previous.call(this,shader,renderer);
  shader.uniforms.surfaceDepthMetres={value:metres};
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float surfaceDepthMetres;');
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
  float depthShift=min(surfaceDepthMetres,max(0.,-mvPosition.z*.01));
  vec4 biasedDepth=projectionMatrix*vec4(mvPosition.xy,mvPosition.z+depthShift,mvPosition.w);
  gl_Position.z=(biasedDepth.z/biasedDepth.w)*gl_Position.w;`);
  // Logarithmic depth is written per fragment, superseding clip-space Z.
  // Apply the same bounded metre separation there, preserving screen coverage
  // and ordinary depth testing against buildings and bridge decks.
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
   '#include <common>\nuniform float surfaceDepthMetres;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <logdepthbuf_fragment>',`#include <logdepthbuf_fragment>
  #ifdef USE_LOGARITHMIC_DEPTH_BUFFER
   if(vIsPerspective>0.5){
    float separation=min(surfaceDepthMetres,max(0.0,(vFragDepth-1.0)*.01));
    gl_FragDepth=log2(max(1e-6,vFragDepth-separation))*logDepthBufFC*.5;
   }
  #endif`);
 };
 material.customProgramCacheKey=()=>`surface-depth-competition-v2-${metres}`;
 return material;
}
