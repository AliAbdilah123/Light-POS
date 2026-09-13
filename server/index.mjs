import {createServer} from 'node:http';
import {createApp} from './app.mjs';
const port=Number(process.env.PORT||8787),host=process.env.HOST||'127.0.0.1',app=await createApp();
const server=createServer(app.handler);server.listen(port,host,()=>console.log(`Light POS API listening on http://${host}:${port}`));
const stop=()=>server.close(()=>{app.close();process.exit(0)});process.on('SIGTERM',stop);process.on('SIGINT',stop);
