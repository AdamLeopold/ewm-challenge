// Display-only batches: source objects and hit testing remain in the editor.
function buildBuildingBatches(rows,cellSize=400){
 const index=new Map(),batches=new Map(),bin=128;
 const overlaps=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
 for(const row of rows){
  const b=row.bounds,pad=2,q=[b[0]-pad,b[1]-pad,b[2]+pad,b[3]+pad];
  const keys=[];for(let x=Math.floor(q[0]/bin);x<=Math.floor(q[2]/bin);x++)for(let y=Math.floor(q[1]/bin);y<=Math.floor(q[3]/bin);y++)keys.push(x+','+y);
  let depth=0;for(const key of keys)for(const prev of index.get(key)||[])if(overlaps(q,prev.bounds))depth=Math.max(depth,prev.depth+1);
  const entry={bounds:q,depth};for(const key of keys){if(!index.has(key))index.set(key,[]);index.get(key).push(entry)}
  const tile=Math.floor((b[0]+b[2])/2/cellSize)+','+Math.floor((b[1]+b[3])/2/cellSize),key=JSON.stringify([depth,tile,row.fill,row.stroke]);
  if(!batches.has(key))batches.set(key,{key,depth,tile,fill:row.fill,stroke:row.stroke,rows:[],bounds:[...b]});
  const batch=batches.get(key);batch.rows.push(row);batch.bounds=[Math.min(batch.bounds[0],b[0]),Math.min(batch.bounds[1],b[1]),Math.max(batch.bounds[2],b[2]),Math.max(batch.bounds[3],b[3])];
 }
 return [...batches.values()].sort((a,b)=>a.depth-b.depth);
}
