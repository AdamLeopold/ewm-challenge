// Native SVG scene. World coordinates use x,-y; CSS pixels are used only for strokes.
// Editing and permissions remain in the shared V6 engine. Camera gestures only set viewBox.
const SVG_NS='http://www.w3.org/2000/svg';
// Preserve source coordinates on shared edges; independent rounding creates slivers.
// Local polygon coordinates and cached paths keep pan updates unchanged.
function svgNode(tag,attrs={}){const n=document.createElementNS(SVG_NS,tag);for(const[k,v]of Object.entries(attrs))if(v!=null)n.setAttribute(k,v);return n}
const svgGeometry=new WeakMap(),svgLines=new WeakMap(),svgGrids=new WeakMap();
function svgLine(points){let d=svgLines.get(points);if(d===undefined){d=points.map(([x,y],i)=>(i?'L':'M')+x+' '+(-y)).join('');svgLines.set(points,d)}return d}
function svgGeometryPath(g){let d=svgGeometry.get(g);if(d===undefined){d=rings(g).map(r=>r.map(([x,y],i)=>(i?'L':'M')+(x-826000)+' '+(839500-y)).join('')+'Z').join('');svgGeometry.set(g,d)}return d}
function svgPath(d,fill='none',stroke=null,width=.65,attrs={}){return svgNode('path',{d,fill,stroke,'fill-rule':'evenodd','clip-rule':'evenodd','stroke-width':width,'vector-effect':'non-scaling-stroke','stroke-linejoin':'round','stroke-linecap':'round',...attrs})}
function svgArea(g,fill='none',stroke=null,width=.65,attrs={}){return svgPath(svgGeometryPath(g),fill||'none',stroke,width,{transform:'translate(826000 -839500)',...attrs})}
const svgDefs=svgNode('defs'),svgClip=svgNode('clipPath',{id:'v6-scope',clipPathUnits:'userSpaceOnUse'});svgDefs.append(svgClip);cv.replaceChildren(svgDefs);
const svgLayers={};for(const name of ['tasks','taskBorders','zoneBorders','free','grid','terrain','water','roadSurfaces','roadLines','buildings','ponds','budget','selection','drawing','journey']){const g=svgNode('g',{'data-layer':name});svgLayers[name]=g;cv.append(g)}for(const name of ['roadSurfaces','water','ponds'])svgLayers[name].setAttribute('clip-path','url(#v6-scope)');
const svgCache=new Map();function svgLayer(name,keys,make){const prev=svgCache.get(name);if(prev&&keys.length===prev.length&&keys.every((k,i)=>k===prev[i]))return;svgLayers[name].replaceChildren(...make());svgCache.set(name,keys)}
function legacyTransform(){return `translate(${v5Display.origin[0]} ${-v5Display.origin[1]}) scale(${1/v5Display.scale})`}
let svgSceneBuilds=0,svgRoadKey=null,svgRoadRevision=0,svgBase=null,svgCameraFrames=0;
let svgCameraFrame=0,svgWidth=cv.clientWidth,svgHeight=cv.clientHeight,svgLastScale=0;
function svgCameraScale(){return Math.min(svgWidth/view[2],svgHeight/view[3])}
function updateSVGCamera(){if(!view)return;const nextBox=`${view[0]} ${-view[1]-view[3]} ${view[2]} ${view[3]}`;if(cv.getAttribute('viewBox')!==nextBox)cv.setAttribute('viewBox',nextBox);cv.dataset.view=JSON.stringify(view);const s=svgCameraScale();if(s>0&&s!==svgLastScale){svgLastScale=s;const metres=100/s;scaleLabel.textContent='100 pixels ≈ '+(metres>=1000?(metres/1000).toFixed(1)+' km':Math.round(metres)+' m');for(const c of svgLayers.drawing.querySelectorAll('circle'))c.setAttribute('r',4/s)}updateVisibleBuildings();cv.dataset.cameraFrames=String(++svgCameraFrames)}
cameraDraw=function(){if(!svgCameraFrame)svgCameraFrame=requestAnimationFrame(()=>{svgCameraFrame=0;updateSVGCamera()})};
settleCamera=function(){cameraDraw()};
new ResizeObserver(entries=>{const r=entries[0].contentRect;svgWidth=r.width;svgHeight=r.height;cameraDraw()}).observe(cv);
// Cache display geometry by the original geometry identity; never replace object geometry.
const buildingDisplayRows=new WeakMap();let buildingBatchState=null,buildingBatches=[],buildingExportRows=[],buildingVisibleBox=null,buildingVisibleKeys='';
function updateBuildingBatches(){
 const key=JSON.stringify(draft.state.buildings),colored=$('#groupColors').checked;
 if(buildingBatchState&&buildingBatchState.base===base&&buildingBatchState.key===key&&buildingBatchState.style===v5Display&&buildingBatchState.report===(colored?report:null)&&buildingBatchState.colored===colored)return;
 buildingBatchState={base,key,style:v5Display,report:colored?report:null,colored};
 const rows=[...buildings().values()].map(b=>{let geom=buildingDisplayRows.get(b.geometry);if(!geom){let x=Infinity,y=Infinity,xx=-Infinity,yy=-Infinity;for(const ring of rings(b.geometry))for(const p of ring){x=Math.min(x,p[0]);y=Math.min(y,p[1]);xx=Math.max(xx,p[0]);yy=Math.max(yy,p[1])}geom={bounds:[x,y,xx,yy],path:svgGeometryPath(b.geometry)};buildingDisplayRows.set(b.geometry,geom)}const style=v5Display?.buildingStyles?.[b.id];return {...geom,id:b.id,fill:colored&&report?.membership[b.id]?groupColor(report.membership[b.id][0]):b.id.startsWith('PLAN')?'#a482ae':style?.[0]||b.display_color||'#7b7f86',stroke:style?style[1]:(b.retained?null:'#34424c')};});
 buildingExportRows=rows;
 const previous=new Map(buildingBatches.map(b=>[b.key,b]));
 buildingBatches=buildBuildingBatches(rows).map(b=>{const old=previous.get(b.key);if(old&&old.rows.length===b.rows.length&&b.rows.every((r,i)=>r.id===old.rows[i].id&&r.path===old.rows[i].path))b.node=old.node;return b});
 buildingVisibleBox=null;cv.dataset.buildingObjects=String(rows.length);cv.dataset.buildingBatches=String(buildingBatches.length);updateVisibleBuildings(true);
}
function buildingViewport(){const s=svgCameraScale(),w=svgWidth/s,h=svgHeight/s;return[view[0]+view[2]/2-w/2,view[1]+view[3]/2-h/2,view[0]+view[2]/2+w/2,view[1]+view[3]/2+h/2]}
function buildingBatchNode(b){if(!b.node)b.node=svgPath(b.rows.map(r=>r.path).join(' '),b.fill,b.stroke,.3,{transform:'translate(826000 -839500)','data-building-batch':b.key,'data-building-count':b.rows.length});return b.node}
function updateVisibleBuildings(force=false){if(!buildingBatchState||!view||!svgWidth||!svgHeight)return;const v=buildingViewport(),old=buildingVisibleBox;
 if(!force&&old&&v[0]>=old[0]&&v[1]>=old[1]&&v[2]<=old[2]&&v[3]<=old[3]&&(old[2]-old[0])<3*(v[2]-v[0]))return;
 const pad=Math.max(100,(v[2]-v[0])*.2),q=[v[0]-pad,v[1]-pad,v[2]+pad,v[3]+pad];buildingVisibleBox=q;
 const visible=buildingBatches.filter(b=>b.bounds[0]<=q[2]&&b.bounds[2]>=q[0]&&b.bounds[1]<=q[3]&&b.bounds[3]>=q[1]);const key=visible.map(b=>b.key).join(';');
 if(force||key!==buildingVisibleKeys){svgLayers.buildings.replaceChildren(...visible.map(buildingBatchNode));buildingVisibleKeys=key;cv.dataset.visibleBuildingBatches=String(visible.length);cv.dataset.visibleBuildingObjects=String(visible.reduce((n,b)=>n+b.rows.length,0));}
}
function gridSVGPaths(g){if(g.svg_paths)return g.svg_paths;let d=svgGrids.get(g);if(d)return d;d={};for(const key of ['aux','basicOnly','large','barrier']){const out=[],runs=g[key]||[];for(let i=0;i<runs.length;i+=2){let n=runs[i+1],start=runs[i];while(n){const x=start%g.nx,take=Math.min(n,g.nx-x),y=Math.floor(start/g.nx);out.push(`M${g.x0+x*2} ${-g.y0-y*2}h${take*2}v-2h${-take*2}Z`);n-=take;start+=take}}d[key]=out.join('')}svgGrids.set(g,d);return d}

draw=function(){if(!base||!draft||cv.hasAttribute('hidden'))return;const started=performance.now();updateSVGCamera();if(svgBase!==base){svgBase=base;svgClip.replaceChildren(svgArea(base.boundary));svgCache.clear();svgRoadKey=null}
 const gross=$('#landView').value==='gross';
 svgLayer('tasks',[planningBase],()=>(planningBase?.tasks||[]).map(t=>svgArea(t.geometry,t.properties.color,null,.65,{'data-task-id':t.id})));
 svgLayer('taskBorders',[planningBase,$('#showTasks').checked],()=>$('#showTasks').checked?(planningBase?.tasks||[]).map(t=>svgArea(t.geometry,null,'#ffffff',.65)):[]);
 svgLayer('zoneBorders',[planningBase,$('#showZones').checked],()=>$('#showZones').checked?(planningBase?.zones||[]).map(z=>svgArea(z.geometry,null,'#8756a0',.7)):[]);
 const roadKey=JSON.stringify(draft.state.roads);if(roadKey!==svgRoadKey){window.roadSurfaceTiles?.refreshSoon();svgRoadKey=roadKey;svgRoadRevision++;}svgLayers.roadLines.style.display=$('#showRoads').checked?'inline':'none';
 svgLayer('free',[free,$('#freeflag').checked,gross],()=>free&&($('#freeflag').checked||!gross)?[svgArea(free.geometry,'#9fcd8b99')]:[]);
 svgLayer('grid',[planningGrid,draft.version,$('#gridVisible').checked,$('#breakVisible').checked],()=>{if(!planningGrid||planningGrid.version!==draft.version)return[];const ds=gridSVGPaths(planningGrid),out=[];for(const[key,color]of [['basicOnly','#9bd48ed9'],['large','#24845bd9']])if($(key==='barrier'?'#breakVisible':'#gridVisible').checked)out.push(svgPath(ds[key],color,null,0,{'data-grid-kind':key}));return out});
 svgLayer('terrain',[planningBase,$('#breakVisible').checked,JSON.stringify(draft.state.ponds||{})],()=>{if(!$('#breakVisible').checked||!planningBase?.terrain)return[];let mask=svgDefs.querySelector('#terrain-visible');if(!mask){mask=svgNode('mask',{id:'terrain-visible',maskUnits:'userSpaceOnUse',x:base.bounds[0],y:-base.bounds[3],width:base.bounds[2]-base.bounds[0],height:base.bounds[3]-base.bounds[1]});svgDefs.append(mask)}mask.replaceChildren(svgArea(base.boundary,'white'),...(interactionData?.ponds||[]).filter(p=>draft.state.ponds?.[p.properties.id]).map(p=>svgArea(p.geometry,'black')));const layer=svgNode('g',{mask:'url(#terrain-visible)'});layer.append(svgArea(planningBase.terrain,'#76658080',null,0,{'data-terrain-constraints':'true'}));return[layer]});
 updateBuildingBatches();svgLayers.buildings.setAttribute('display',$('#showBuildings').checked?'inline':'none');
 const displayedPonds=window.v6Ponds?.()||planningSummary?.ponds||[],pondIds=new Set(displayedPonds.map(p=>p.id));
 svgLayer('water',[base.water,draft.version,interactionData,window.v6Ponds?null:planningSummary],()=> (base.water?.features||[]).filter(f=>!pondIds.has(f.properties.id)&&!draft.state.ponds?.[f.properties.id]).map(f=>svgArea(f.geometry,'none','#2385b5',1)));
 svgLayer('ponds',[draft.version,interactionData,window.v6Ponds?null:planningSummary],()=>displayedPonds.map(p=>svgArea(p.geometry,p.filled?'#c5ac7a88':null,'#2385b5',1,{'data-pond-id':p.id})));
 const budget=budgetSelection(),budgetOpen=$('#budgetKind').closest('details').open;svgLayer('budget',[budget,budgetOpen,draft.version],()=>!budget||!budgetOpen?[]:budget.geometry?[svgArea(budget.geometry,'#f43f5e7a','#be123c',1.6)]:(budget.members||[]).map(k=>buildings().get(k)).filter(Boolean).map(b=>svgArea(b.geometry,'#f43f5e7a','#be123c',1.6)));
 svgLayer('selection',[selected,activeUnit,activeTask,draft.version,v5Display],()=>{const out=[];if(activeTask){const t=planningBase?.tasks.find(t=>t.id===activeTask);if(t)out.push(svgArea(t.geometry,null,'#244651',1.8))}if(selected?.category==='buildings'){for(const id of base.operation_objects?.groups?.[selected.id]?.component_ids||[selected.id]){const b=buildings().get(id);if(b)out.push(svgArea(b.geometry,null,'#bd3738',2))}}if(selected?.category==='roads')out.push(svgPath(svgLine(selected.value.geometry.coordinates),'none','#dd6027',3));if(selected?.category==='ponds')out.push(svgArea(selected.value.geometry,null,'#bd3738',2));if(activeUnit&&!activeTask&&v5Display){const r=legacyRegion(activeUnit);if(r)out.push(svgPath(r.path,'none','#244651',2,{transform:legacyTransform()}))}return out});
 svgLayer('drawing',[JSON.stringify(points)],()=>points.length?[svgPath(svgLine(points),'none','#ce572f',2),...points.map(([x,y])=>svgNode('circle',{cx:x,cy:-y,r:4/svgCameraScale(),fill:'#b74f27'}))]:[]);
 svgLayer('journey',[journey],()=>!journey?[]:(journey.steps||[]).filter(s=>s.coordinates?.length).map(s=>svgPath(svgLine(s.coordinates),'none',({walk:'#d14b3e',bicycle:'#458b35',car:'#3b68bd',bus:'#147878',parking:'#777'})[s.kind]||'#777',3)));
 if(!selected)selectionCard.textContent=activeTask?'Selected planning zone：'+activeTask:activeUnit?'Current局部范围：'+activeUnit:'Select a zone, building or pond';
 cv.dataset.renderer='svg';cv.dataset.draftVersion=draft.version;cv.dataset.renderStats=JSON.stringify({count:++svgSceneBuilds,last:performance.now()-started,roadBuilds:svgRoadRevision});window.v6State={version:draft.version,selected:selected?.id||null,style:'V5',renderer:'SVG',roadWidthsFromCurrentNetwork:true};
};
function serializedMap(){updateSVGCamera();const copy=cv.cloneNode(true);copy.querySelector('[data-layer="buildings"]').replaceChildren(...buildingExportRows.map(r=>svgPath(r.path,r.fill,r.stroke,.3,{transform:'translate(826000 -839500)','data-building-id':r.id})));copy.removeAttribute('id');copy.removeAttribute('hidden');copy.setAttribute('width',cv.clientWidth);copy.setAttribute('height',cv.clientHeight);copy.setAttribute('style','background:#f4f7f8');for(const p of copy.querySelectorAll('path'))p.setAttribute('fill-rule','evenodd');return new XMLSerializer().serializeToString(copy)}
async function exportMapPNG(){const text=serializedMap(),url=URL.createObjectURL(new Blob([text],{type:'image/svg+xml'}));try{const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=cv.clientWidth*devicePixelRatio;c.height=cv.clientHeight*devicePixelRatio;const x=c.getContext('2d');x.fillStyle='#f4f7f8';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);const blob=await new Promise(resolve=>c.toBlob(resolve));if(!blob)throw Error('截图Export失败');download(blob,'v6-map.png','image/png')}finally{URL.revokeObjectURL(url)}}
const svgExport=document.createElement('button');svgExport.id='downloadSVG';svgExport.textContent='Export SVG map';$('#downloadMap').after(svgExport);bind('downloadSVG',()=>download(serializedMap(),'v6-map.svg','image/svg+xml'));
window.addEventListener('resize',cameraDraw);draw();
// Notices change header height; keep the map in the viewport without a page scrollbar.
new ResizeObserver(()=>{resizeLayout();cameraDraw()}).observe(document.querySelector('header'));

