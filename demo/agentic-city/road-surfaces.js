/* Surface tiles are display-only derivatives of the same network/scenario as routing. */
(() => {
  let manifest=null,epoch=0,timer=null,activeKey='',pending=null;
  const cache=new Map(),groups=new Map(),lineGroups=new Map();
  const overlap=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
  async function refresh() {
    if(!base||!draft||!view||!manifest)return;
    if(base.network_version!==manifest.network_version)throw Error('路面与地图网络版本不匹配');
    const bounds=[view[0],view[1],view[0]+view[2],view[1]+view[3]],lod=view[2]>4000?'far':'near';
    const visible=manifest.tiles.filter(t=>overlap(t.bounds,bounds));
    const key=draft.version+':'+lod+':'+visible.map(t=>t.id).join(',');
    if(key===activeKey)return;
    activeKey=key;const ticket=++epoch,version=draft.version,network=base.network_version;
    const edited=Object.keys(draft.state.roads).length>0;
    const needed=new Set(visible.map(t=>t.id));
    for(const [id,g] of groups)if(!needed.has(id)){g.remove();groups.delete(id);lineGroups.get(id)?.remove();lineGroups.delete(id);}
    const queue=[...visible];
    async function worker(){while(queue.length){
      const tile=queue.shift(),cacheKey=version+':'+lod+':'+tile.id;
      let data=cache.get(cacheKey);
      if(!data){
        if(edited)data=await api('road-surfaces',{name:draftName,version,network_version:network,bounds:tile.bounds,lod});
        else{const response=await fetch('/demo/agentic-city/road-tiles/'+tile.id+'-'+lod+'.json',{cache:'no-cache'});if(!response.ok)throw Error('路面分块读取失败');data=await response.json();}
        if(data.network_version!==network)throw Error('路面分块版本不匹配');
        cache.set(cacheKey,data);if(cache.size>400)cache.delete(cache.keys().next().value);
      }
      if(ticket!==epoch||draft.version!==version)return;
      let group=groups.get(tile.id);
      if(!group){group=svgNode('g',{'data-road-tile':tile.id});groups.set(tile.id,group);svgLayers.roadSurfaces.append(group);const lines=svgNode('g',{'data-centerline-tile':tile.id});lineGroups.set(tile.id,lines);svgLayers.roadLines.append(lines);}
      if(group.dataset.cacheKey===cacheKey)continue;
      const nodes=[],buckets=new Map();
      for(const feature of data.features){
        if(!['Polygon','MultiPolygon'].includes(feature.geometry.type))continue;
        const p=feature.properties;
        const bucketKey=p.source_kind+':'+(p.level??p.LVL);
        if(!buckets.has(bucketKey))buckets.set(bucketKey,{p,paths:[]});
        buckets.get(bucketKey).paths.push(svgGeometryPath(feature.geometry));
      }
      for(const {p,paths} of buckets.values()){
        const path=svgPath(paths.join(' '),'#ffffff',
          (p.level??p.LVL)!==0?'#69768a':null,.4,{'data-surface-id':p.surface_id||p.cell_id||'',
          'data-surface-source':p.source_kind,'data-level':p.level??p.LVL,transform:'translate(826000 -839500)'});
        const title=svgNode('title');title.textContent=(p.source_kind==='official'?'Official road surface':'Estimated / planned road surface')+' · Level '+(p.level??p.LVL);path.append(title);nodes.push(path);
      }
      const paths=[];
      for(const row of data.centerlines||[]){const cs=row.geometry.coordinates;paths.push(cs.map((p,i)=>(i?'L':'M')+p[0]+','+(-p[1])).join(' '));}
      const centerNodes=[];if(paths.length){const line=svgPath(paths.join(' '),'none','#575957',.8,{'data-centerlines':'true','vector-effect':'non-scaling-stroke'});line.style.pointerEvents='none';centerNodes.push(line);}
      lineGroups.get(tile.id).replaceChildren(...centerNodes);group.replaceChildren(...nodes);group.dataset.cacheKey=cacheKey;cv.dataset.roadBuildCount=String(Number(cv.dataset.roadBuildCount||0)+1);
    }}
    await Promise.all(Array.from({length:4},worker));
    if(ticket===epoch){cv.dataset.roadNetworkVersion=network;cv.dataset.roadScenarioVersion=version;cv.dataset.roadTileCount=String(groups.size);}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>{pending=refresh().catch(e=>{activeKey='';notice(e.message)});},80);}
  const previousCamera=cameraDraw,previousSettle=settleCamera;
  cameraDraw=function(){previousCamera();schedule()};
  settleCamera=function(){previousSettle();schedule()};
  svgLayers.roadSurfaces.removeAttribute('clip-path');
  svgLayers.roadLines.replaceChildren();
  fetch('/demo/agentic-city/road-tiles/manifest.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('路面清单读取失败');return r.json()})
    .then(data=>{manifest=data;schedule()}).catch(e=>notice(e.message));
  window.roadSurfaceTiles={refresh,refreshSoon:()=>{activeKey='';schedule()},settled:()=>pending,get manifest(){return manifest}};
})();
