// Minimal decoder for trusted Chromium screenshots only, no new dependency.
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
export function decodeScreenshot(buffer:Buffer){
 assert.equal(buffer.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 let width=0,height=0,channels=0;const chunks:Buffer[]=[];
 for(let offset=8;offset<buffer.length;){const length=buffer.readUInt32BE(offset),type=buffer.toString('ascii',offset+4,offset+8),data=buffer.subarray(offset+8,offset+8+length);assert.equal(data.length,length);
  if(type==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);assert.equal(data[8],8);assert.ok(data[9]===2||data[9]===6);channels=data[9]===6?4:3;assert.equal(data[12],0);}
  if(type==='IDAT')chunks.push(data);offset+=length+12;
 }
 assert.ok(width&&height&&channels);const stride=width*channels,raw=inflateSync(Buffer.concat(chunks)),pixels=Buffer.alloc(stride*height);assert.equal(raw.length,(stride+1)*height);
 const paeth=(a:number,b:number,c:number)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<height;y++){const filter=raw[y*(stride+1)];assert.ok(filter<=4);for(let x=0;x<stride;x++){const index=y*stride+x,a=x>=channels?pixels[index-channels]:0,b=y?pixels[index-stride]:0,c=y&&x>=channels?pixels[index-stride-channels]:0;const prior=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c);pixels[index]=(raw[y*(stride+1)+1+x]+prior)&255;}}
 return{width,height,pixel(x:number,y:number){assert.ok(Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<width&&y<height);const at=(y*width+x)*channels;return[pixels[at],pixels[at+1],pixels[at+2]];}};
}
