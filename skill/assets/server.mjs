import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('./editor/',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.md':'text/plain','.woff':'font/woff','.woff2':'font/woff2','.svg':'image/svg+xml'};
const port=Number(process.env.PORT||4173);
http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    const pathname=decodeURIComponent(url.pathname);
    const name=pathname==='/'||pathname==='/docs'||pathname==='/create'||pathname==='/rig'||pathname==='/rig/'||pathname==='/studio'||pathname==='/studio/'?'index.html':pathname.slice(1);
    const target=path.resolve(root,name);
    if(!target.startsWith(root+path.sep)&&target!==path.join(root,'index.html')) {res.writeHead(403);return res.end('Forbidden');}
    const data=await readFile(target);
    res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(data);
  } catch {res.writeHead(404);res.end('Not found');}
}).on('error',e=>{console.error(e.code==='EADDRINUSE'?`Port ${port} is in use. Set PORT to another local port.`:e.message);process.exit(1);}).listen(port,'127.0.0.1',function(){console.log(`Moro: http://127.0.0.1:${this.address().port}`);});
