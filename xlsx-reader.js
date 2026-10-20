// Offline XLSX reader for standard Excel OpenXML files. No third-party script or upload.
// Uses the browser's built-in ZIP/DEFLATE decompressor (supported by recent Edge).
async function readXlsx(file){
 const bytes=new Uint8Array(await file.arrayBuffer()); const dv=new DataView(bytes.buffer);const decoder=new TextDecoder();
 const u16=i=>dv.getUint16(i,true), u32=i=>dv.getUint32(i,true);
 let eocd=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(u32(i)===0x06054b50){eocd=i;break;}
 if(eocd<0)throw Error('올바른 XLSX 파일이 아닙니다.');const count=u16(eocd+10),off=u32(eocd+16),files=new Map();let pos=off;
 for(let i=0;i<count;i++){
  if(u32(pos)!==0x02014b50)throw Error('엑셀 ZIP 목차를 읽을 수 없습니다.');
  const method=u16(pos+10),compressed=u32(pos+20),len=u16(pos+28),extra=u16(pos+30),comment=u16(pos+32),local=u32(pos+42),name=decoder.decode(bytes.slice(pos+46,pos+46+len));
  files.set(name,{method,compressed,local});pos+=46+len+extra+comment;
 }
 async function read(name){const f=files.get(name);if(!f)return null;const start=f.local+30+u16(f.local+26)+u16(f.local+28),data=bytes.slice(start,start+f.compressed);if(f.method===0)return decoder.decode(data);if(f.method!==8)throw Error('지원하지 않는 엑셀 압축 방식입니다.');if(!('DecompressionStream'in globalThis))throw Error('현재 브라우저에서 XLSX 압축 해제를 지원하지 않습니다. Edge를 업데이트하거나 CSV로 저장해 주세요.');let ds;try{ds=new DecompressionStream('deflate-raw');}catch{throw Error('브라우저가 XLSX 압축 해제를 지원하지 않습니다. Excel에서 CSV UTF-8로 저장하여 올려주세요.');}return await new Response(new Blob([data]).stream().pipeThrough(ds)).text();}
 const xml=async name=>{const raw=await read(name);if(raw===null)return null;const doc=new DOMParser().parseFromString(raw,'application/xml');if(doc.querySelector('parsererror'))throw Error('엑셀 XML이 올바르지 않습니다.');return doc;};
 const ss=await xml('xl/sharedStrings.xml');const shared=ss?Array.from(ss.getElementsByTagName('si'),si=>Array.from(si.getElementsByTagName('t'),n=>n.textContent).join('')):[];
 const book=await xml('xl/workbook.xml');if(!book)throw Error('엑셀 시트 정보가 없습니다.');
 const rel=await xml('xl/_rels/workbook.xml.rels');const relation=new Map();if(rel)for(const r of rel.getElementsByTagName('Relationship'))relation.set(r.getAttribute('Id'),r.getAttribute('Target'));
 const sheet=book.getElementsByTagName('sheet')[0];let path='xl/worksheets/sheet1.xml';if(sheet){const id=sheet.getAttribute('r:id')||sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');const target=relation.get(id);if(target)path=target.startsWith('/')?target.slice(1):'xl/'+target.replace(/^\.\//,'');}
 let doc=await xml(path);if(!doc)doc=await xml('xl/worksheets/sheet1.xml');if(!doc)throw Error('첫 번째 시트를 열 수 없습니다.');
 const grid=[];for(const r of doc.getElementsByTagName('row')){const rowIndex=(Number(r.getAttribute('r'))||grid.length+1)-1;if(rowIndex>10000)break;const out=[];for(const c of r.getElementsByTagName('c')){const ref=c.getAttribute('r')||'';const colLetters=/^[A-Z]+/.exec(ref)?.[0]||'A';let col=0;for(const letter of colLetters)col=col*26+letter.charCodeAt(0)-64;col--;const type=c.getAttribute('t'),v=c.getElementsByTagName('v')[0]?.textContent;let value=type==='inlineStr'?Array.from(c.getElementsByTagName('t'),e=>e.textContent).join(''):type==='s'?shared[Number(v)]??'':v??'';if(type==='b')value=value==='1'?'예':'아니오';if(col>=0&&col<150)out[col]=value;}grid[rowIndex]=out;}
 return grid.filter(Boolean);
}
