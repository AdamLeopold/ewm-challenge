// Shared deterministic facade layout; all coordinates remain source coordinates.
export const styleNames=['村屋／低层住宅','厂房／仓库','较高住宅','办公／研发','商业／餐饮','公共设施','棚盖／农业附属','小型服务建筑'];
// Curated architectural paint families; deterministic per building, not surveyed colours.
export const palettes=[
 ['#d6bd91','#c59372','#d7c9ad','#86a6b4','#a5b594','#cfa398','#c6ad78','#a6bfc1'],
 ['#729bb5','#92acb7','#b3b7b0','#859f95','#b09878','#b5bcbf','#73929d','#c0b298'],
 ['#cfaa87','#b78470','#d1c0a2','#91acbf','#b5c2ac','#c8a49a','#b3b9c3','#dac8b0'],
 ['#91b4ca','#6d98b0','#b4c6cd','#c6c2ad','#8ca6b3','#a6bcb5','#c9cdd0','#a1b7ce'],
 ['#cb926a','#dfbd8b','#a2b39b','#88a9b1','#bc8b80','#d4c5ac','#99acbd','#bbab79'],
 ['#d4c295','#b8c6af','#8eabbc','#c6a083','#b7bbc9','#d4cfc0','#9eb8b2','#c3b28c'],
 ['#5f91b2','#819faa','#779c92','#b0a17b','#ad8069','#92a9b5','#6f929f','#b7b6a6'],
 ['#c4ab77','#cbbb98','#8ca8b4','#be947c','#a3b495','#a1b6bd','#c6a197','#c9c8b5']];
export const roofPalettes=[
 ['#a16a50','#737f87','#b18c61','#63848d','#8c5650','#939b91'],
 ['#537c96','#738591','#708b7d','#a5a9a2','#986e56','#64727e'],
 ['#936852','#7f8b92','#a9a99c','#607c8d','#806363','#8e9d90'],
 ['#6e8696','#9ca7a8','#627c87','#a9aaa0','#778e8a','#7a8391'],
 ['#b47c51','#6b8c91','#8e5e56','#9c9e8b','#63819b','#a98d67'],
 ['#85969c','#b0aa93','#6f8d89','#9e775d','#8b8c9b','#a4aca6'],
 ['#4e82a5','#688d99','#698d7e','#aa7b59','#975e54','#a2aba5'],
 ['#a38a5f','#7b9298','#9e6e56','#78917a','#929ba4','#aea68e']];
export function hashID(id){let h=0;for(const c of id)h=(h*31+c.charCodeAt(0))>>>0;return h;}
export function classify(item,height){const label=(item.type_label||'')+' '+(item.function_assessment?.label||'');const open=(item.parts||[]).some(p=>p.open_canopy);let profile=7;
 if(open||/棚|农业配套|养殖配套|通用附属|郊野土地/.test(label))profile=6;
 else if(/仓储|仓库|工场|工业|厂房/.test(label))profile=1;
 else if(/办公|研发|商办/.test(label))profile=3;
 else if(/餐饮|商业|商场/.test(label))profile=4;
 else if(/住宅|居住|村屋|建屋/.test(label))profile=height>18?2:0;
 else if(/学校|社区|文化|警务|设施|供水|军营|公用/.test(label))profile=5;
 if(height<2.5&&!open)profile=7;return {profile,open};}
export function openingSize(profile,pitch,floor){
 const width=profile===3?Math.max(.5,pitch-.48):profile===4?Math.min(2.35,pitch-.55):profile===6?1.65:profile===7?1.05:profile===5?1.8:1.5;
 const height=profile===3?Math.max(.6,floor-.65):profile===4?2.26:profile===6?.65:profile===7?.85:profile===1?1.1:profile===5?1.65:1.55;
 const center=profile===1||profile===6?floor*.74:profile===7?Math.min(2.25,floor*.63):profile===4?1.37:floor*.56;
 return {width,height,center};}
function contains(tris,x,z){for(const t of tris){const a=(t[2]-t[0])*(z-t[1])-(t[3]-t[1])*(x-t[0]),b=(t[4]-t[2])*(z-t[3])-(t[5]-t[3])*(x-t[2]),c=(t[0]-t[4])*(z-t[5])-(t[1]-t[5])*(x-t[4]);if((a>=-.002&&b>=-.002&&c>=-.002)||(a<=.002&&b<=.002&&c<=.002))return true;}return false;}
function fits(face,s,z,w,h){for(let a=0;a<=4;a++)for(let b=0;b<=4;b++)if(!contains(face.tris,s+(a/4-.5)*w,z+(b/4-.5)*h))return false;return true;}
export function buildLayout(positions,indices,ranges,metadata,atlas){
 const frame=new Float32Array(positions.length/3*4),layout=new Float32Array(frame.length),records=[];let checked=0;
 for(const range of ranges){const ids=new Set();for(let i=range.start*3;i<range.end*3;i++)ids.add(indices[i]);if(!ids.size)continue;
 let base=Infinity,top=-Infinity,cx=0,cy=0;for(const v of ids){base=Math.min(base,positions[v*3+2]);top=Math.max(top,positions[v*3+2]);cx+=positions[v*3];cy+=positions[v*3+1];}cx/=ids.size;cy/=ids.size;
 base=metadata[range.id]?.surface_base_mPD??base;
 const height=top-base,{profile,open}=classify(metadata[range.id]||{},height),faces=[];
 // Group only near-coplanar triangles; test each opening against actual triangle coverage.
 const groups=new Map();
 for(let i=range.start*3;i<range.end*3;i+=3){const vs=[indices[i],indices[i+1],indices[i+2]],a=vs.map(v=>[positions[v*3],positions[v*3+1],positions[v*3+2]]),e=a[1].map((v,j)=>v-a[0][j]),f=a[2].map((v,j)=>v-a[0][j]);let nx=e[1]*f[2]-e[2]*f[1],ny=e[2]*f[0]-e[0]*f[2],nz=e[0]*f[1]-e[1]*f[0];const length=Math.hypot(nx,ny,nz);if(length<1e-7||Math.abs(nz)/length>.10)continue;const horizontal=Math.hypot(nx,ny);nx/=horizontal;ny/=horizontal;if(nx*(a[0][0]-cx)+ny*(a[0][1]-cy)<0){nx=-nx;ny=-ny}const d=nx*a[0][0]+ny*a[0][1],key=[Math.round(nx*50),Math.round(ny*50),Math.round(d*5)].join(':');let face=groups.get(key);
 if(!face){face={nx,ny,ux:-ny,uy:nx,lo:Infinity,hi:-Infinity,z0:Infinity,z1:-Infinity,area:0,tris:[],vertices:[]};groups.set(key,face)}
 const t=[];for(const v of a){const s=v[0]*face.ux+v[1]*face.uy;t.push(s,v[2]);face.lo=Math.min(face.lo,s);face.hi=Math.max(face.hi,s);face.z0=Math.min(face.z0,v[2]);face.z1=Math.max(face.z1,v[2]);}face.tris.push(t);face.vertices.push(...vs);face.area+=length*.5;
 }
 for(const face of groups.values()){face.z0=Math.max(face.z0,base);const w=face.hi-face.lo,h=face.z1-face.z0,coverage=face.area/Math.max(.001,w*h);if(open||w<2.2||h<2.5||coverage<.60)continue;if(profile===5&&(w<5.5||h<4.5||coverage<.72))continue;
 const pitch=profile===3?2.6:profile===6?6:profile===7?5:profile===1?4.8:profile===4?3.2:3.0;
 face.cols=Math.max(1,Math.floor(w/pitch));face.rows=(profile===1||profile>=6||profile===4)?1:Math.max(1,Math.round(h/(profile===3?3.7:profile===5?3.6:3.1)));face.width=w;face.height=h;faces.push(face);}
 const doorCandidates=faces.filter(f=>!metadata[range.id]?.suppress_facade_door&&f.z0-base<.25&&f.width>3&&f.height>2.6).sort((a,b)=>((b.ny<-.3?100:0)+b.width)-((a.ny<-.3?100:0)+a.width));let entrance=null;
 for(const f of doorCandidates){const pitch=f.width/f.cols,w=profile===1?Math.min(3.2,pitch-.25):profile===3?Math.min(2.6,pitch-.2):profile===5?1.7:profile===4?1.3:1.1,h=profile===1?2.9:2.35;const order=Array.from({length:f.cols},(_,i)=>i).sort((a,b)=>Math.abs(a-(f.cols-1)/2)-Math.abs(b-(f.cols-1)/2));
 for(const col of order){const s=f.lo+(col+.5)*pitch;if(fits(f,s,base+.08+h/2,w+.14,h)){entrance={face:f,col,width:w,height:h};break}}if(entrance)break;}
 let windows=0;for(const f of faces){const offset=atlas.length/4,pitch=f.width/f.cols,floor=f.height/f.rows,dim=openingSize(profile,pitch,floor);
 for(let row=0;row<f.rows;row++)for(let col=0;col<f.cols;col++){const s=f.lo+(col+.5)*pitch,z=f.z0+row*floor+dim.center;const door=entrance?.face===f&&entrance.col===col&&row===0;let allowed=fits(f,s,z,dim.width+.20,dim.height+.20);checked++;
 if(door&&z-dim.height/2<base+entrance.height+.18)allowed=false;
 if(allowed)windows++;atlas.push(allowed?255:0,door?255:0,0,255);}
 for(const v of f.vertices){frame.set([f.ux,f.uy,offset,f.cols+f.rows/1024],v*4);layout.set([f.lo,f.z0,f.width,f.height],v*4);}}
 records.push({id:range.id,profile,open,faces:faces.length,windows,doors:entrance?1:0,reason:open?'开放棚盖仅赋材质':!faces.length?'无足够完整墙面，仅赋材质':!entrance?'未找到接地完整入口墙面':null});}
 return {frame,layout,records,checked};}
