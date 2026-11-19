/* New roads declare all permissions once; committed road attributes are read-only. */
(() => {
  const modes = [['walk','Walk',4.5],['bicycle','Bicycle',15],['car','Car',30],['bus','Bus',25]];
  const legacy = document.querySelector('#roadModes');
  if (!legacy) throw Error('新路表单缺少交通方式容器');
  legacy.hidden = true;
  const box = document.createElement('fieldset');
  box.id = 'roadModeRules';
  const legend = document.createElement('legend');
  legend.textContent = 'New road: configure modes; committed properties are immutable';
  box.append(legend);
  const roadClass=document.createElement('select');roadClass.id='newRoadClass';roadClass.setAttribute('aria-label','New road class');
  for(const [value,label]of [['local','Local road'],['collector','Collector road'],['arterial','Arterial road'],['shared_street','Shared street'],['footway','Footway'],['cycleway','Cycleway']])roadClass.add(new Option(label,value));
  box.append(document.createTextNode('Road class '),roadClass);
  const widthLabel=document.createElement('label');widthLabel.textContent='Initial road width (m)';
  const width=document.createElement('input');width.id='newRoadWidth';width.type='number';width.min='2';width.max='20';width.value='6';widthLabel.append(width);box.append(widthLabel);
  const controls = new Map();
  for (const [key,label,speed] of modes) {
    const row=document.createElement('div'), name=document.createElement('label');
    name.textContent=label+' ';
    const access=document.createElement('select');access.setAttribute('aria-label',label+'Mode permission');
    access.add(new Option('Prohibited','denied'));access.add(new Option('Allowed','allowed'));
    if (['walk','bicycle'].includes(key)) access.value='allowed';
    const direction=document.createElement('select');direction.setAttribute('aria-label',label+'Direction');
    for (const [text,value] of [['Both directions','both'],['Along drawn direction','forward'],['Against drawn direction','reverse']]) direction.add(new Option(text,value));
    const velocity=document.createElement('input');velocity.type='number';velocity.min='0.1';velocity.max=String({walk:10,bicycle:45,car:130,bus:100}[key]);velocity.step='0.1';velocity.value=String(speed);
    velocity.setAttribute('aria-label',label+'Estimate速度，公里每小时');velocity.style.width='75px';
    row.append(name,access,direction,velocity,document.createTextNode(' km/h（模拟参数）'));
    let push=null;
    if(['bicycle'].includes(key)) {push=document.createElement('input');push.type='checkbox';push.checked=true;push.setAttribute('aria-label',label+'独立Dismounting permission');const labelPush=document.createElement('label');labelPush.append(push,document.createTextNode('Allowed推行（须同时AllowedWalk）'));row.append(labelPush);}
    box.append(row);controls.set(key,{access,direction,velocity,push});
  }
  legacy.after(box);
  const elevation=document.createElement('input');elevation.id='roadElevation';elevation.type='number';elevation.step='.1';elevation.min='-100';elevation.max='3000';elevation.placeholder='桥隧规划路面标高 mPD';elevation.setAttribute('aria-label','桥隧规划路面标高mPD');box.append(elevation);
  for(const id of ['setTurn','clearTurns']){const el=document.getElementById(id);if(el){el.hidden=true;el.disabled=true;el.onclick=null;}}
  for(const id of ['direction','walkDirection','speed','groupBoundary']){const el=document.getElementById(id);if(el){el.disabled=true;(el.closest('label')||el).hidden=true;}}
  for(const mode of ['bicycle']) {
    const travel=document.querySelector('#travelMode');
    if(travel && ![...travel.options].some(o=>o.value===mode)) travel.add(new Option(modes.find(r=>r[0]===mode)[1],mode));
  }
  roadAttrs=function() {
    const mode_rules={};
    for(const [key,c] of controls) mode_rules[key]={status:c.access.value,direction:c.direction.value,
      push_allowed:c.push?.checked||false,speed_kmh:c.access.value==='allowed'?Number(c.velocity.value):null,basis:'explicit_planning_assumption',speed_basis:'scenario_parameter'};
    const allowed=Object.keys(mode_rules).filter(k=>mode_rules[k].status==='allowed');
    if(!allowed.length) throw Error('新路至少Allowed一种Travel modes');
    return {modes:allowed,mode_rules,road_class:roadClass.value,width_m:Number(document.querySelector('#newRoadWidth').value),
      direction:mode_rules.car.direction,walk_direction:mode_rules.walk.direction,
      car_kmh:Number(controls.get('car').velocity.value),level:Number(document.querySelector('#level').value),
      elevation_mpd:elevation.value===''?null:Number(elevation.value),group_boundary:['collector','arterial'].includes(roadClass.value)};
  };
  const priorStart=start;
  start=function(action){priorStart(action);if(action==='road')document.querySelector('#modeLabel').textContent='依次点Roads转折点，再点击Roads面板的“Preview new road”';box.disabled=action!=='road';box.hidden=action!=='road';for(const id of ['newRoadWidth','level'])document.getElementById(id).disabled=action!=='road';};
  box.disabled=true;box.hidden=true;
  for(const id of ['newRoadWidth','level'])document.getElementById(id).disabled=true;
  const note=document.createElement('p');note.textContent='Existing roads may only be removed where permitted. Remove a new road and rebuild with a new ID to change its properties.';
  box.after(note);
  const previewDialog=document.createElement('dialog');previewDialog.id='roadCreationPreview';
  const previewTitle=document.createElement('h3');previewTitle.textContent='Check road connections and footprint';
  const previewInfo=document.createElement('pre');previewInfo.style.cssText='max-height:55vh;overflow:auto;white-space:pre-wrap';
  const commit=document.createElement('button');commit.textContent='Commit road (locks attributes)';const back=document.createElement('button');back.textContent='Back to edit';
  previewDialog.append(previewTitle,previewInfo,commit,back);document.body.append(previewDialog);back.onclick=()=>previewDialog.close();
  const finishRoad=document.createElement('button');finishRoad.id='finishRoad';finishRoad.textContent='Preview new road';finishRoad.onclick=()=>document.querySelector('#finish').click();document.querySelector('#drawRoad').after(finishRoad);
  const cancelRoad=document.createElement('button');cancelRoad.textContent='Cancel drawing';cancelRoad.onclick=()=>document.querySelector('#cancel').click();finishRoad.after(cancelRoad);
  let roadPreview=null;
  commit.onclick=async()=>{try{if(!roadPreview||roadPreview.version!==draft.version)throw Error('Plan已变化，请重新预览');commit.disabled=true;const r=roadPreview.road;await change('roads',r.id,r);selected={category:'roads',id:r.id,value:r};previewDialog.close();start('');notice('新路已提交，属性只读；recalculate通勤')}catch(e){notice(e.message)}finally{commit.disabled=false}};
  const previousFinish=document.querySelector('#finish').onclick;
  document.querySelector('#finish').onclick=async e=>{
   if(mode!=='road')return previousFinish(e);
   try{
    if(points.length<2)throw Error('至少两items端点');const version=draft.version,id='PLAN-R-'+crypto.randomUUID();
    const road=await api('snap',{name:draftName,road:{id,...roadAttrs(),geometry:{type:'LineString',coordinates:structuredClone(points)}}});
    const result=await api('road-preview',{name:draftName,version,road});if(version!==draft.version)throw Error('Plan已变化，请重新预览');
    roadPreview=result;previewInfo.textContent=JSON.stringify({类别:road.road_class,方式规则:road.mode_rules,宽度米:road.width_m,层级:road.level,标高mPD:road.elevation_mpd,占地平方米:result.footprint_m2,新增占地平方米:result.new_occupied_m2,各方式端点:result.connections,内部接入点:result.junctions,整个方案道路费用:result.cost,说明:result.note},null,2);
    const layer=svgLayers.drawing;layer.querySelector('[data-road-preview]')?.remove();layer.append(svgArea(result.footprint,'#3aa8bb55','#287b88',1,{'data-road-preview':'true'}));previewDialog.showModal();
   }catch(error){notice(error.message)}
  };
  window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===document.querySelector('#three').contentWindow&&e.data.type==='3d-applied'&&journey?.version===draft.version&&e.data.version===draft.version)e.source.postMessage({type:'road-journey',version:draft.version,journey},location.origin)});
  let pendingRoadFocus=null;
  function focusRoad3D(){if(pendingRoadFocus&&window.threeVersion===draft.version){document.querySelector('#three').contentWindow.postMessage({type:'v6-focus-road',version:draft.version,road:pendingRoadFocus},location.origin);pendingRoadFocus=null;}}
  const focus=document.createElement('button');focus.id='focusRoad3D';focus.textContent='Locate selected road in 3D';
  focus.onclick=()=>{if(selected?.category!=='roads'){notice('请先SelectRoads');return;}pendingRoadFocus=selected.value;document.querySelector('#view3d').click();focusRoad3D()};
  document.querySelector('#focusOther').after(focus);
  const searchPanel=document.createElement('details');searchPanel.innerHTML='<summary>Road search and access filters</summary><input id="roadSearchText" aria-label="RoadsName或源ID" placeholder="RoadsName、road_id 或源ID"><select id="roadSearchMode" aria-label="Travel modes"><option value="">All modes</option></select><select id="roadSearchStatus" aria-label="通行状态" disabled><option value="allowed">Allowed</option><option value="denied">Prohibited</option></select><select id="roadSearchSource" aria-label="路网来源"><option value="">All sources</option><option value="official">Official</option><option value="osm">OSM supplemental</option><option value="estimated">Estimated connection</option><option value="planned">规划</option></select><button id="roadSearchSubmit">Search</button><p id="roadSearchCount"></p><div id="roadSearchResults"></div><button id="roadSearchNext" hidden>Next page</button>';
  box.closest('details').after(searchPanel);
  for(const [key,label]of modes)document.querySelector('#roadSearchMode').add(new Option(label,key));
  document.querySelector('#roadSearchMode').onchange=e=>document.querySelector('#roadSearchStatus').disabled=!e.target.value;
  let nextSearchOffset=0,searchTicket=0;
  async function searchRoads(offset=0){
   const ticket=++searchTicket,version=draft.version;
   try{const result=await api('road-search',{name:draftName,version,text:document.querySelector('#roadSearchText').value,mode:document.querySelector('#roadSearchMode').value,status:document.querySelector('#roadSearchStatus').value,source:document.querySelector('#roadSearchSource').value,offset});if(ticket!==searchTicket||version!==draft.version)return;
    document.querySelector('#roadSearchCount').textContent='共 '+result.total+' items物理路段 · Current显示 '+result.rows.length+' items';const results=document.querySelector('#roadSearchResults');results.replaceChildren();
    for(const row of result.rows){const button=document.createElement('button');button.textContent=row.name+' · '+row.source_kind+' · '+row.id;button.onclick=async()=>{try{await chooseRoad(row.id);const cs=selected.value.geometry.coordinates,x=Math.min(...cs.map(p=>p[0])),y=Math.min(...cs.map(p=>p[1])),X=Math.max(...cs.map(p=>p[0])),Y=Math.max(...cs.map(p=>p[1]));view=[x-100,y-100,Math.max(200,X-x+200),Math.max(200,Y-y+200)];draw()}catch(e){notice(e.message)}};results.append(button);}
    nextSearchOffset=result.next_offset;document.querySelector('#roadSearchNext').hidden=nextSearchOffset===null;
   }catch(error){notice(error.message)}
  }
  document.querySelector('#roadSearchSubmit').onclick=()=>searchRoads();document.querySelector('#roadSearchNext').onclick=()=>searchRoads(nextSearchOffset);
  document.querySelector('#exportPlan').onclick=async()=>{try{
    const version=draft.version,state=structuredClone(draft.state),references={};
    for(const [id,road]of Object.entries(state.roads))references[id]=road?{road_id:id,source_kind:'planned',geometry:road.geometry,mode_rules:road.mode_rules,road_class:road.road_class,width_m:road.width_m}:await api('road',{id});
    if(version!==draft.version)throw Error('Export期间Plan发生变化，请重新Export');
    download(JSON.stringify({schema:'v6-physical-road-scenario-v1',network_version:base.network_version,runtime_revision:draft.runtime_revision,scenario_revision:version,edit_revision:draft.revision,transport_modes:modes.map(m=>m[0]),crs:'EPSG:2326',units:'metres',road_references:references,name:draftName,version,state},null,2),draftName+'.json','application/json');
   }catch(error){notice(error.message)}};

  document.querySelector('#importPlan').onchange=async e=>{try{const file=JSON.parse(await e.target.files[0].text());if(file.network_version!==base.network_version)throw Error('Import路网版本不一致或缺失，请使用迁移报告处理旧Plan');draft=await api('change',{name:draftName,revision:draft.revision,operation:{kind:'replace',state:file.state}});showState();notice('已Import同版Plan，全部权限已重新校验')}catch(error){notice(error.message)}finally{e.target.value=''}};
  window.addEventListener('message',async e=>{
   if(e.origin!==location.origin||e.source!==document.querySelector('#three').contentWindow||e.data.version!==draft.version)return;
   if(e.data.type==='3d-applied')focusRoad3D();
   if(e.data.type==='v6-select-road')try{
    await chooseRoad(e.data.id);if(e.data.version!==draft.version)return;
    const points=selected.value.geometry.coordinates,xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys),X=Math.max(...xs),Y=Math.max(...ys),pad=Math.max(60,Math.max(X-x,Y-y)*.5);
    view=[x-pad,y-pad,X-x+2*pad,Y-y+2*pad];draw();
   }catch(error){notice(error.message)}
  });
})();
