// Pure XY collision rules shared by the renderer and regression tests.
export function insideRing(x,y,r){let hit=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit}return hit}
function segmentDistance(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/d)):0;return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)}
export function intersectsCanopy(x,y,radius,g){if(!g)return false;const ps=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];return ps.some(p=>(insideRing(x,y,p[0])&&!p.slice(1).some(r=>insideRing(x,y,r)))||p.some(r=>r.some((a,i)=>i&&segmentDistance(x,y,r[i-1],a)<radius)))}
export function planningMask(points,d){const blockers=[...Object.values(d.buildings||{}).filter(b=>b?.replace_geometry),...(d.ponds||[])];return points.map(t=>blockers.some(b=>intersectsCanopy(t[0]+826000,t[1]+839500,t[3]*2.8,b.geometry)))}
