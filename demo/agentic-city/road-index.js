// Share only bit-identical attributes; keep the index stream in original triangle order.
export function indexRoadGeometry(T,g){
 if(g.index)return g;
 const names=Object.keys(g.attributes),attrs=names.map(n=>g.attributes[n]),count=attrs[0].count;
 const bits=attrs.map(a=>new Uint32Array(a.array.buffer,a.array.byteOffset,a.array.length));
 let capacity=1;while(capacity<count*2)capacity*=2;
 const table=new Uint32Array(capacity),sources=new Uint32Array(count),indices=new Uint32Array(count);let unique=0;
 const equal=(a,b)=>attrs.every((attr,k)=>{for(let j=0;j<attr.itemSize;j++)if(bits[k][a*attr.itemSize+j]!==bits[k][b*attr.itemSize+j])return false;return true});
 for(let i=0;i<count;i++){
  let h=2166136261;for(let k=0;k<attrs.length;k++)for(let j=0;j<attrs[k].itemSize;j++)h=Math.imul(h^bits[k][i*attrs[k].itemSize+j],16777619);
  let slot=(h>>>0)&(capacity-1);while(table[slot]&&!equal(i,sources[table[slot]-1]))slot=(slot+1)&(capacity-1);
  if(!table[slot]){sources[unique]=i;table[slot]=++unique}indices[i]=table[slot]-1;
 }
 attrs.forEach((a,k)=>{const values=new Uint32Array(unique*a.itemSize);for(let i=0;i<unique;i++)for(let j=0;j<a.itemSize;j++)values[i*a.itemSize+j]=bits[k][sources[i]*a.itemSize+j];g.setAttribute(names[k],new T.BufferAttribute(new Float32Array(values.buffer),a.itemSize,a.normalized))});
 g.setIndex(new T.BufferAttribute(indices,1));return g;
}
