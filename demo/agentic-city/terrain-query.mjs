// Exact vertical intersection with terrain triangles, indexed in XY (no height approximation).
export function terrainIndex(triangles,cell=64){
 const buckets=new Map(),wide=[];
 for(let i=0;i<triangles.length;i+=9){
  const ax=triangles[i+3]-triangles[i],ay=triangles[i+4]-triangles[i+1],az=triangles[i+5]-triangles[i+2],bx=triangles[i+6]-triangles[i],by=triangles[i+7]-triangles[i+1],bz=triangles[i+8]-triangles[i+2];
  const nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;
  if(Math.abs(nz)<1e-8||nz*nz<.01*(nx*nx+ny*ny+nz*nz))continue;
  const xs=[triangles[i],triangles[i+3],triangles[i+6]],ys=[triangles[i+1],triangles[i+4],triangles[i+7]],a=Math.floor(Math.min(...xs)/cell),b=Math.floor(Math.max(...xs)/cell),c=Math.floor(Math.min(...ys)/cell),d=Math.floor(Math.max(...ys)/cell);if((b-a+1)*(d-c+1)>256){wide.push(i);continue}for(let x=a;x<=b;x++)for(let y=c;y<=d;y++){const k=x+','+y;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(i)}}
 const query=function(x,y){let z=-Infinity;for(const i of [...(buckets.get(Math.floor(x/cell)+','+Math.floor(y/cell))||[]),...wide]){const ax=triangles[i],ay=triangles[i+1],bx=triangles[i+3],by=triangles[i+4],cx=triangles[i+6],cy=triangles[i+7],det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(det)<1e-12)continue;const u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/det,v=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/det,w=1-u-v;if(u>=-1e-9&&v>=-1e-9&&w>=-1e-9){const h=u*triangles[i+2]+v*triangles[i+5]+w*triangles[i+8];if(h<=3000)z=Math.max(z,h)}}return Number.isFinite(z)?z:null};
 // Explicit display-only extrapolation for holes/outside edges of the terrain mesh.
 query.nearest=function(x,y,limit=250){
  const seen=new Set();let best=limit*limit,result=null,cx=Math.floor(x/cell),cy=Math.floor(y/cell);
  for(let radius=0;radius<=Math.ceil(limit/cell)+1;radius++){
   const candidates=[];
   for(let dx=-radius;dx<=radius;dx++)for(let dy=-radius;dy<=radius;dy++)if(radius===0||Math.max(Math.abs(dx),Math.abs(dy))===radius)candidates.push(...(buckets.get((cx+dx)+','+(cy+dy))||[]));
   if(radius===0)candidates.push(...wide);
   for(const i of candidates){if(seen.has(i))continue;seen.add(i);
    for(let edge=0;edge<3;edge++){const a=i+edge*3,b=i+((edge+1)%3)*3,dx=triangles[b]-triangles[a],dy=triangles[b+1]-triangles[a+1],den=dx*dx+dy*dy;if(!den)continue;
     const t=Math.max(0,Math.min(1,((x-triangles[a])*dx+(y-triangles[a+1])*dy)/den)),distance=(x-triangles[a]-t*dx)**2+(y-triangles[a+1]-t*dy)**2;
     if(distance<best){best=distance;result={height:triangles[a+2]+t*(triangles[b+2]-triangles[a+2]),distance_m:Math.sqrt(distance),basis:'nearest_existing_terrain_edge_extrapolation',estimated:true}}
    }
   }
   if(result&&radius*cell>result.distance_m+cell)break;
  }
  return result;
 };
 return query;
}
