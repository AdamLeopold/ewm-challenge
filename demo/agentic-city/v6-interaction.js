
let originalPlanningTasks=null,appliedZoningPatch=null;
function applyZoningPatch(){
 if(!planningBase||!draft)return;
 if(!originalPlanningTasks)originalPlanningTasks=planningBase.tasks;
 const patch=draft.zoning_patch||{key:'',tasks:[],reclaimed_roads:{type:'Polygon',coordinates:[]}};
 if(appliedZoningPatch===patch.key)return;
 const changed=new Map(patch.tasks.map(t=>[t.id,t]));
 planningBase={...planningBase,tasks:originalPlanningTasks.map(t=>changed.get(t.id)||t),reclaimed_roads:patch.reclaimed_roads};
 appliedZoningPatch=patch.key;
}
// One controller for V5-style selections. Uses current V6 geometry, permissions and draft.
let interactionData=null,activeUnit=null,selectionEpoch=0,selectionLoading=false;

const regionInfo=document.createElement('section');regionInfo.id='regionInfo';selectionCard.after(regionInfo);
const pondInfo=document.createElement('section');pondInfo.id='pondInfo';selectionCard.after(pondInfo);pondInfo.hidden=true;regionInfo.before($('#buildingFacts'));
const gridPanel=$('#gridCalculate').closest('details'),budgetPanel=$('#budgetKind').closest('details'),commutePanel=$('#query').closest('details');
gridPanel.open=true;budgetPanel.open=true;commutePanel.open=true;
$('#origin').after($('#pickOrigin'));$('#destination').after($('#pickDestination'));
const selectionMode=document.createElement('div');selectionMode.className='panelbuttons';selectionMode.innerHTML='<button id="normalSelect">Select zone or object</button><button id="regionOnly">Select zones only</button>';$('.v6-tools').append(selectionMode);
let regionOnly=false;bind('normalSelect',()=>{regionOnly=false;clickAction='';start('');notice('Select a zone, building or pond查看资料')});bind('regionOnly',()=>{regionOnly=true;clickAction='';start('');notice('点击地块，查看该位置的局部Rule')});
const ancillary=document.createElement('select');ancillary.id='ancillarySelect';ancillary.setAttribute('aria-label','Not independently editable');$('#planningTask').after(ancillary);ancillary.hidden=true;
const buildingCommute=document.createElement('div');buildingCommute.className='panelbuttons';buildingCommute.innerHTML='<button id="selectedOrigin">Use as journey origin</button><button id="selectedDestination">Use as journey destination</button>';
$('#buildingFacts').append(buildingCommute);
const fmt=n=>Number(n||0).toLocaleString('zh-CN',{maximumFractionDigits:2});
function put(parent,tag,text){let e=document.createElement(tag);e.textContent=text??'';parent.append(e);return e}
function row(table,label,value){let tr=put(table,'tr','');put(tr,'td',label);put(tr,'td',value??'Unspecified')}
function legacyRegion(id){return interactionData?.regionMap.get(id)}
function taskForUnit(id){return legacyRegion(id)?.planning_task_id|| (planningBase?.tasks.some(t=>t.id===id)?id:'')}
function localAt(p){if(planningBase?.existing_roads&&contains(planningBase.existing_roads,p)&&!contains(planningBase.reclaimed_roads||{type:'Polygon',coordinates:[]},p))return null;if(!interactionData||!v5Display)return null;const x=(p[0]-v5Display.origin[0])*v5Display.scale,y=(v5Display.origin[1]-p[1])*v5Display.scale;return [...interactionData.regions].reverse().find(r=>r.hitPath.isPointInFill(new DOMPoint(x,y)))||null}
function taskAt(p){
 if(planningBase?.existing_roads&&contains(planningBase.existing_roads,p)&&!contains(planningBase.reclaimed_roads||{type:'Polygon',coordinates:[]},p))return null;
 const tasks=planningBase?.tasks||[],inside=tasks.find(t=>contains(t.geometry,p));if(inside)return inside;
 // Exactly-on-border clicks need a deterministic owner. The source coordinate precision (0.01mm) only
 // absorbs floating-point noding error; it does not expand planning geometry.
 const epsilon=1e-5,near=tasks.filter(t=>{const b=shapeInfo(t.geometry).bounds;if(p[0]<b[0]-epsilon||p[0]>b[2]+epsilon||p[1]<b[1]-epsilon||p[1]>b[3]+epsilon)return false;
  return rings(t.geometry).some(r=>r.some((a,i)=>{if(!i)return false;const z=r[i-1],dx=a[0]-z[0],dy=a[1]-z[1],q=Math.max(0,Math.min(1,((p[0]-z[0])*dx+(p[1]-z[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-z[0]-q*dx,p[1]-z[1]-q*dy)<=epsilon}));});
 return near.sort((a,b)=>Number(b.properties.category==='closed')-Number(a.properties.category==='closed')||a.id.localeCompare(b.id))[0];
}
window.v6Ponds=()=>interactionData?.ponds.map(p=>({id:p.properties.id,geometry:p.geometry,filled:!!draft?.state.ponds?.[p.properties.id]}));
function renderRegion(){
 regionInfo.replaceChildren();const t=planningBase?.tasks.find(t=>t.id===activeTask);regionInfo.hidden=!t;if(!t)return;
 const p=t.properties;put(regionInfo,'h2',t.id+' · '+p.name);
 put(regionInfo,'p',({free:'Flexible land use',restricted:'Restricted use',closed:'Retained land'})[p.category]+' · '+fmt(p.gross_area_m2/10000)+' 公顷');
 put(regionInfo,'p','Function：'+(p.category==='free'?'由参赛者自由决定':p.function));
 if(p.category!=='closed')put(regionInfo,'p','AllowedUse：'+p.use_labels.join('、'));
 const table=put(regionInfo,'table','');for(const [k,label]of Object.entries({build:'Build',demolish:'Demolish',modify_road:'修改Roads',fill_water:'Pond filling',maintenance:'Maintenance',reassign:'Change use'}))row(table,label,p.operations[k]);
 if(Object.keys(p.limits).length){const d=put(regionInfo,'details','');put(d,'summary','Development conditions');put(d,'pre',JSON.stringify(p.limits,null,2))}
 const r=planningSummary?.task===activeTask&&planningSummary?.version===draft.version?planningSummary:null;
 if(r){put(regionInfo,'p','Net land after terrain exclusions '+fmt(r.net_available_m2)+'㎡ · Terrain restrictions '+fmt(r.terrain_limited_m2)+'㎡ · Buildings '+r.buildings+' items · Residents '+fmt(r.residents)+' people · Jobs '+fmt(r.jobs)+' items');
  for(const q of r.scheme_checks||[])if(q.parent_id===p.limits.parent_id)put(regionInfo,'p','整区Plan：'+q.status+'；Floor area '+fmt(q.floor_m2)+'／'+fmt(q.max_floor_m2)+'㎡；Care beds '+q.care_beds+'／'+q.required_care_beds+'，尚缺 '+q.missing_care_beds+' 床。')}
 const trace=put(regionInfo,'details','');put(trace,'summary','Zoning evidence');put(trace,'p',p.boundary_basis);put(trace,'p',(p.source_ids||[]).join('、')||'None固定Use，按比赛RuleFlexible land use');
 for(const option of $('#use').options)option.disabled=p.category==='closed'||!p.allowed_uses.includes(option.value);
}
function spaceKey(state=draft.state,task=activeTask){
 const t=planningBase?.tasks.find(t=>t.id===task),bounds=t?shapeInfo(t.geometry).bounds:null;
 const geometry=g=>g?[g.type,g.coordinates]:null;
 const touches=(g,pad=0)=>{if(!g||!bounds)return !bounds;const a=shapeInfo(g).bounds;return a[0]-pad<=bounds[2]&&a[2]+pad>=bounds[0]&&a[1]-pad<=bounds[3]&&a[3]+pad>=bounds[1]};
 const bs=Object.entries(state.buildings).filter(([k,b])=>JSON.stringify(geometry(b?.geometry))!==JSON.stringify(geometry(bmap?.get(k)?.geometry))&&(touches(b?.geometry)||touches(bmap?.get(k)?.geometry))).sort(([a],[b])=>a.localeCompare(b)).map(([k,b])=>[k,geometry(b?.geometry)]);
 const oldRoadTouches=k=>{const a=base.road_bounds?.[k];return !!a&&(!bounds||a[0]<=bounds[2]&&a[2]>=bounds[0]&&a[1]<=bounds[3]&&a[3]>=bounds[1])};
 // Either old or new occupancy invalidates this region; distant regions reuse it.
 const rs=Object.entries(state.roads).filter(([k,r])=>oldRoadTouches(k)||(r&&touches(r.geometry,r.width_m/2))).sort(([a],[b])=>a.localeCompare(b)).map(([k,r])=>[k,base.road_bounds?.[k]||null,geometry(r?.geometry),r?.width_m,r?.level]);
 const ps=Object.entries(state.ponds||{}).filter(([k,v])=>v&&(!interactionData||touches(interactionData.ponds.find(p=>p.properties.id===k)?.geometry))).sort(([a],[b])=>a.localeCompare(b));
 return JSON.stringify([base.version,base.zoning_version,base.network_version,bs,rs,ps]);
}
let gridTicket=0;const gridCache=new Map();
const baselineGridsReady=(async()=>{try{const response=await fetch('/demo/agentic-city/baseline-grids.json.gz',{cache:'no-cache'});if(!response.ok)return;const raw=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();while(!window.editorAPI?.base)await new Promise(r=>setTimeout(r,50));if(raw.geometry_schema!=='polygon-only-v2'||raw.network_version!==base.network_version||raw.zoning_version!==base.zoning_version||raw.version!==base.version)return;for(const g of raw.grids)gridCache.set(spaceKey({buildings:{},roads:{}},g.task)+':'+g.task,g);window.baselineGridVersion=raw.version;window.baselineGridCount=raw.grids.length;cv.dataset.preloadedGrids=String(raw.grids.length)}catch(e){console.warn('Baseline grid preload unavailable',e)}})();
async function fetchZoningGrid(id,v,revision){const r=await api('zoning-grid',{name:draftName,task:id,version:v,revision});return r.status==='ready'?r.result:null}
async function autoGrid(){const id=activeTask,v=draft.version,revision=draft.revision,ticket=++gridTicket;if(!id){planningGrid=null;delete cv.dataset.gridTask;delete cv.dataset.gridVersion;$('#gridStats').textContent='Select a zone to view 12 m / 20 m building envelopes';draw();return}const key=spaceKey()+':'+id;$('#gridStats').textContent='正在计算 '+id+' 的可建包络…';try{const cached=gridCache.get(key);if(!cached)draw();const raw=cached||await fetchZoningGrid(id,v,revision);if(!raw||(!cached&&raw.version!==v))return;if(ticket!==gridTicket||activeTask!==id||draft.version!==v)return;const g={...raw,version:v};gridCache.set(key,g);planningGrid=g;cv.dataset.gridTask=id;cv.dataset.gridVersion=v;requestAnimationFrame(()=>{if(activeTask===id)cv.dataset.gridPaintMs=String(Math.round(performance.now()-Number(cv.dataset.selectionStarted||performance.now())))});if(window.planningState)window.planningState.grid=g;$('#gridStats').textContent='Current zone：'+id+'｜12 m only '+fmt(g.basic_only_m2)+'㎡；20 m envelope '+fmt(g.large_m2)+'㎡；Net land after terrain exclusions '+fmt(g.free_m2)+'㎡。\n12m／20mcandidate placements：'+g.placements+'／'+g.large_placements+'；2 m fixed-orientation grid; green envelopes do not replace planning permission.';draw();cv.dataset.gridReadyMs=String(Math.round(performance.now()-Number(cv.dataset.selectionStarted||performance.now())))}catch(e){if(ticket===gridTicket)notice(e.message)}}
const regionRefresh=refreshPlanning;refreshPlanning=async function(){applyZoningPatch();const v=draft.version,revision=draft.revision,t=activeTask;const summary=regionRefresh();if(activeTask)autoGrid();const result=await summary;if(v!==draft.version||revision!==draft.revision||t!==activeTask)return;renderRegion();return result};
bind('gridCalculate',autoGrid);
async function chooseRegion(id,locate=false,keepObject=false){
 if(!keepObject)document.querySelector('aside').scrollTop=0;
 cv.dataset.selectionStarted=String(performance.now());planningGrid=null;gridTicket++;const unit=legacyRegion(id),task=taskForUnit(id);activeUnit=unit?.id||null;activeTask=task;$('#planningTask').value=task;if(planningSummary?.task!==task){planningSummary=null;budgetOptions(false);$('#taskStats').textContent='正在更新区域资料…'}ancillary.value=!task&&unit?unit.id:'';
 if(!keepObject){++selectionEpoch;roadPickTicket++;roadHits.replaceChildren();selected=null;$('#buildingFacts').hidden=true;pondInfo.hidden=true;selectionCard.textContent='Selected planning zone：'+(task||id||'Full extent');$('#selection').textContent=selectionCard.textContent}
 if(locate){const t=planningBase.tasks.find(t=>t.id===task);if(t){let [x,y,X,Y]=shapeInfo(t.geometry).bounds,pad=Math.max(X-x,Y-y)*.12;view=[x-pad,y-pad,X-x+pad*2,Y-y+pad*2]}}
 renderRegion();if(task){await refreshPlanning();if($('#freeflag').checked||$('#landView').value==='net')await refreshFree()}else{planningSummary=null;$('#budgetItem').replaceChildren();showBudget(false);$('#taskStats').textContent=id?'范围外，不开放规划':'Full extent';await autoGrid()}draw();
}
function owningUnit(id,detail){const current=buildings().get(id);if(id in draft.state.buildings&&current?.planning_task_id)return current.planning_task_id;const o=interactionData.objects[id];if(o?.owner&&legacyRegion(o.owner))return o.owner;const task=detail?.task_id;if(planningBase.tasks.some(t=>t.id===task))return task;let b=buildings().get(id);if(b){let [x,y,X,Y]=shapeInfo(b.geometry).bounds;return taskAt([(x+X)/2,(y+Y)/2])?.id||''}return ''}
function setBuildingFields(b){$('#buildingName').value=b.name||b.id;$('#use').value=b.use;$('#height').value=b.height_m;$('#storeys').value=b.storeys;$('#jobs').value=b.jobs??'';$('#residents').value=b.residents??'';$('#beds').value=b.care_beds??0;$('#topPD').value=b.top_mPD??0;$('#capacityMode').value=b.capacity_mode||'auto';$('#manualCapacity').value=JSON.stringify(b.manual_capacity||b.capacity||{},null,2);manualSignature=b.capacity_signature;$('#capacityConfirm').checked=false;$('#capacityResult').textContent=capacityText(b);setCapacityMode()}
const baseBuildingRender=renderBuildingDetails;
renderBuildingDetails=function(r){
 baseBuildingRender(r);$('#buildingFacts').hidden=false;const panel=$('#buildingFacts'),p=r.source_properties||{},b=r.current||{};
 put(panel,'p','所属规划区域：'+(b.planning_task_id||r.task_id||taskForUnit(p.task_id)||'NoneZone归属'));put(panel,'p','objects占地：'+fmt(r.geometry_area_m2)+'㎡ · Display height：'+fmt(b.height_m)+' m');
 if(r.matched_component&&r.matched_component!==r.id)put(panel,'p','本次命中组件：'+r.matched_component+'；操作主体：'+r.id);
 if(r.components?.length>1){const parts=put(panel,'details','');put(parts,'summary','组成部分 · '+r.components.length+'items（新操作按整体执行）');for(const c of r.components){put(parts,'p',c.id+(c.id===r.matched_component?'（本次命中）':'')+' · '+(c.removed?'历史状态：已Demolish':'现存')+' · Residents '+fmt(c.capacity?.residents||0)+' · Jobs '+fmt(c.capacity?.jobs||0))}}
 const table=put(panel,'table','');table.className='capacity-table';const labels={building_area_reference_m2:'Buildings占地参考（㎡）',waste_tonnes_per_day:'日垃圾处理能力（吨）',households:'住户Capacity',care_beds:'照护床位',patient_beds:'病床',school_places:'学位',simultaneous_service_users:'服务Capacity',simultaneous_visitors:'同时容纳',storage_floor_m2:'仓储Floor area（㎡）',covered_area_m2:'覆盖面积（㎡）',service_area_m2:'服务面积（㎡）',water_treatment_m3_per_day:'供水处理能力',additional_reservoir_storage_m3:'新增储水量'};
 for(const [key,m]of Object.entries(b.capacity_metrics||{})){if(['residents','jobs'].includes(key))continue;row(table,labels[key]||key,m.status==='not_applicable'?'Not applicable':m.status==='unknown'?'Unknown':fmt(m.value)+' · '+(m.source||'场景Estimate'))}
 put(panel,'p','CurrentCapacity依据：'+(r.current_capacity_basis||b.capacity_basis||'详见资料档案'));
 if(p.household_tenure)put(panel,'p','租购：'+({buy:'买房',rent:'租房'}[p.household_tenure]||p.household_tenure)+'（比赛场景分配，非产权确认）');
 if(p.retention_policy)put(panel,'p','保留Rule：'+(typeof p.retention_policy==='string'?p.retention_policy:'ProhibitedDemolish或Change use；原保护条件保留。'));
 if(p.demolition_policy)put(panel,'p','DemolishRule：'+(p.demolition_policy.decision_label||p.demolition_policy.decision));
 if(p.ownership_exception)put(panel,'p','归属例外：与历史限制范围相交 '+fmt(p.ownership_exception.protected_or_pending_m2)+'㎡；Roads '+fmt(p.ownership_exception.independent_road_m2)+'㎡；范围外 '+fmt(p.ownership_exception.outside_competition_m2)+'㎡。');
 const archive=put(panel,'details','');put(archive,'summary','Function、原Height和Capacity来源');put(archive,'pre',JSON.stringify({功能:p.function_refinement||p.function_assessment,高度:p.height_assessment,面积计算:p.gfa_basis,官方来源:p.official_source_layer,源容量:p.capacity,来源状态:p.capacity_source_status},null,2));panel.append(buildingCommute);
};
async function chooseBuilding(id,{locate=false,from3d=false}={}){
 const budgetStarted=performance.now();budgetTicket++;focusedBudget=null;const matchedComponent=id;id=base.operation_objects?.parents?.[id]||id;const epoch=++selectionEpoch,b=buildings().get(id)||buildings().get(matchedComponent);roadPickTicket++;roadHits.replaceChildren();if(!b)return;document.querySelector('aside').scrollTop=0;selected={category:'buildings',id,value:b};setBuildingFields(b);selectionCard.textContent='Selected building：'+(b.name||id)+' · '+id;pondInfo.hidden=true;draw();const knownOwner=interactionData.objects[id]?.owner||b.planning_task_id;const regionWork=knownOwner?chooseRegion(knownOwner,false,true):null;const r=await api('building-detail',{name:draftName,id:matchedComponent});if(epoch!==selectionEpoch)return;selectionCard.textContent='Selected building：'+(b.name||id)+' · '+id+(r.component_ids?.length>1?' · '+r.component_ids.length+'items组件（Complete group操作）':'');
 renderBuildingDetails(r);$('#selection').textContent=JSON.stringify(r,null,2);if(from3d)$('#three').contentWindow.postMessage({type:'v6-logical-detail',version:draft.version,detail:r},location.origin);const owner=owningUnit(id,r);if(regionWork&&taskForUnit(knownOwner)===taskForUnit(owner))regionWork.catch(e=>notice(e.message));else chooseRegion(owner,false,true).catch(e=>notice(e.message));if(epoch!==selectionEpoch)return;
 if(r.demolition_group)loadBudgetGroup(r.demolition_group,budgetStarted).catch(e=>notice(e.message));
 fromThree=from3d;if(locate)focus2D(id);draw();
}
async function choosePond(p){document.querySelector('aside').scrollTop=0;const epoch=++selectionEpoch;selected={category:'ponds',id:p.properties.id,value:p};$('#buildingFacts').hidden=true;draw();const owner=p.properties.task_id||taskAt(rings(p.geometry).flat()[0])?.id;await chooseRegion(owner,false,true);const r=await api('pond-detail',{name:draftName,id:p.properties.id});if(epoch!==selectionEpoch)return;pondInfo.replaceChildren();pondInfo.hidden=false;put(pondInfo,'h2',p.properties.name||r.id);put(pondInfo,'p','Pond '+r.id+' · '+(r.filled?'Filled':r.allowed?'可Pond filling':'Current不Eligible for filling'));put(pondInfo,'p',r.reason||'塘内Buildings须先满足Demolish条件；费用另计。');if(r.blockers?.length)put(pondInfo,'pre',r.blockers.map(x=>(x.removable?'须先Demolish：':'不可拆，ProhibitedPond filling：')+x.id+(x.demolition_group?'（Complete group '+x.demolition_group+'）':'')).join('\n'));put(pondInfo,'p','Estimate费用 HK$ '+Number(r.cost_HKD).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' · Fill volume '+fmt(r.volume_m3)+'m³');put(pondInfo,'p','Post-fill elevation '+fmt(r.target_mPD)+' mPD；'+r.level_basis);const d=put(pondInfo,'details','');put(d,'summary','Pond fillingRule和Estimate依据');put(d,'pre',JSON.stringify(r.properties,null,2));selectionCard.textContent='CurrentPond：'+r.id;$('#budgetKind').value='pond';budgetOptions();$('#budgetItem').value=r.id;showBudget();draw()}
const toolSelect=selectAt;
selectAt=async function(p){
 if(planningBase?.existing_roads&&contains(planningBase.existing_roads,p)&&!contains(planningBase.reclaimed_roads||{type:'Polygon',coordinates:[]},p)){await chooseRegion('');selectionCard.textContent='现有Roads：白色占地Retained land，不属于规划分区';return}
 if(!interactionData)throw Error('区域资料正在加载，请稍候');
 if(mode||['entrance','busStop','turn'].includes(clickAction)){await toolSelect(p);return}
 const building=!regionOnly&&$('#showBuildings').checked&&[...buildings().values()].reverse().find(b=>contains(b.geometry,p));
 if(['origin','destination'].includes(clickAction)){if(!building){notice('请点击Buildings作为通勤'+(clickAction==='origin'?'起点':'终点'));return}const field=clickAction;clickAction='';$('#'+field).value=building.id;notice('已设置'+(field==='origin'?'起点':'终点'));await chooseBuilding(building.id);return}
 if(building){await chooseBuilding(building.id);return}
 const pond=!regionOnly&&interactionData.ponds.find(pn=>contains(pn.geometry,p));if(pond){await choosePond(pond);return}
 const task=taskAt(p);if(task){++selectionEpoch;await chooseRegion(task.id)}
};
$('#planningTask').onchange=async()=>{try{const id=$('#planningTask').value;await chooseRegion(id,true);if(!id){view=[...initial];await refreshPlanning();draw()}}catch(e){notice(e.message)}};
ancillary.onchange=()=>chooseRegion(ancillary.value,true);
for(const [button,field]of [['selectedOrigin','origin'],['selectedDestination','destination']])bind(button,()=>{if(selected?.category!=='buildings')throw Error('Select a building first');$('#'+field).value=selected.id;commutePanel.open=true;commutePanel.scrollIntoView({block:'nearest'});notice('已设置'+(field==='origin'?'起点':'终点'))});
for(const id of ['pickOrigin','pickDestination'])$('#'+id).addEventListener('click',()=>{regionOnly=false;notice(id==='pickOrigin'?'点击起点Buildings':'点击终点Buildings')});
const priorState=showState;showState=function(){priorState();if(selected?.category==='buildings'&&!buildings().has(selected.id)){$('#buildingFacts').hidden=true;selected=null}if(!activeTask){planningGrid=null;gridTicket++}};
$('#modeLabel').textContent='拖动平移，滚轮缩放；直接Select a zone, building or pond';
(async()=>{interactionData=await(await fetch('/demo/agentic-city/v5-interaction-data.json')).json();interactionData.regionMap=new Map(interactionData.regions.map(r=>{r.hitPath=document.createElementNS('http://www.w3.org/2000/svg','path');r.hitPath.setAttribute('d',r.path);r.hitPath.setAttribute('fill-rule','evenodd');return[r.id,r]}));interactionData.taskMap=new Map(interactionData.tasks.map(t=>[t.id,t]));const unresolved=interactionData.regions.filter(r=>!r.planning_task_id);ancillary.hidden=!unresolved.length;ancillary.add(new Option('Not independently editable',''));for(const r of unresolved)ancillary.add(new Option(r.id+' · 暂不开放操作',r.id));while(!planningBase||!v5Display)await new Promise(r=>setTimeout(r,100));await baselineGridsReady;window.v6Interaction={ready:true,chooseRegion,chooseBuilding,choosePond,get unit(){return activeUnit},get task(){return activeTask}};const id=new URLSearchParams(location.search).get('object')||new URLSearchParams(location.search).get('building');if(id&&buildings().has(base.building_aliases?.[id]||id))await chooseBuilding(base.building_aliases?.[id]||id,{locate:true});draw()})().catch(e=>notice(e.message));
// Refresh displayed facts after edits without retaining an obsolete selected object.
const stateWithSelection=showState;showState=function(){applyZoningPatch();cv.dataset.selectionStarted=String(performance.now());stateWithSelection();const id=selected?.category==='buildings'?selected.id:null,v=draft.version;if(id&&buildings().has(id))api('building-detail',{name:draftName,id}).then(r=>{if(draft.version===v&&selected?.id===id){selected.value=buildings().get(id);renderBuildingDetails(r)}}).catch(e=>notice(e.message));else if(!selected){$('#buildingFacts').hidden=true;pondInfo.hidden=true}};
const finishWithSelection=$('#finish').onclick;$('#finish').onclick=async()=>{await finishWithSelection();if(!mode&&selected?.category==='buildings'&&buildings().has(selected.id))await chooseBuilding(selected.id)};
// As in V5, choose the actual road when carriageways overlap in the map.
const roadHits=document.createElement('section');roadHits.id='roadHits';$('#selectRoad').closest('details').prepend(roadHits);
let roadPickTicket=0;
async function chooseRoad(id){const epoch=++selectionEpoch,v=draft.version;const r=draft.state.roads[id]||await api('road',{id});if(epoch!==selectionEpoch||v!==draft.version)return;selected={category:'roads',id,value:r};for(const [field,key]of [['level','level'],['direction','direction'],['walkDirection','walk_direction'],['speed','car_kmh']])$('#'+field).value=r[key];$('#roadModes').value=r.modes.join(',');$('#groupBoundary').checked=!!r.group_boundary;$('#selection').textContent=JSON.stringify(r,null,2);selectionCard.textContent='CurrentRoads：'+id+' · 第 '+r.level+' 层';$('#buildingFacts').hidden=true;pondInfo.hidden=true;draw();if(clickAction==='turn'){if(!turnFirst){turnFirst=id;notice('再点图Select转入Roads');return}if(turnFirst===id)throw Error('请Select两items不同路段');let state=structuredClone(draft.state);state.turns=[...(state.turns||[]),[turnFirst,id]];draft=await api('change',{name:draftName,revision:draft.revision,operation:{kind:'replace',state}});clickAction='';turnFirst=null;start('');showState();notice('Saved禁转')}else notice('已Select实际路段；属性只读，可按规划权限Demolish')}
const selectionWithRoads=selectAt;selectAt=async function(p){if(mode!=='roadSelect')return selectionWithRoads(p);const ticket=++roadPickTicket,hits=await api('near',{name:draftName,xy:p});if(ticket!==roadPickTicket)return;roadHits.replaceChildren();put(roadHits,'h3','请Select实际路段');for(const h of [...new Map(hits.map(h=>[h.id,h])).values()]){const b=put(roadHits,'button',h.id+' · '+h.mode+' · '+h.distance.toFixed(1)+' m');b.onclick=()=>chooseRoad(h.id).catch(e=>notice(e.message))}$('#selectRoad').closest('details').open=true;roadHits.scrollIntoView({block:'nearest'});notice(hits.length?'从候选列表SelectRoads，避免误选平行车道或桥下Roads':'附近没有候选路段')};

