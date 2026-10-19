(() => {
  const $ = id => document.getElementById(id);
  const COLORS = {green:"#16a34a",yellow:"#eab308",red:"#dc2626"};
  const STORAGE_KEY = "sonometro_escolar_sessions_v1";
  let stream=null, audioContext=null, analyser=null, source=null, raf=0, interval=null;
  let running=false, startedAt=0, lastTick=0, elapsedMs=0, sampleCount=0, sumDb=0, minDb=Infinity, maxDb=-Infinity;
  let times={green:0,yellow:0,red:0}, samples=[], lastDb=null, lastColor="green", lastSavedSession=null;
  let offset = Number(localStorage.getItem("sonometro_offset") || 90);
  $("offset").value=offset;
  const fmtTime = ms => { const sec=Math.floor(ms/1000); return String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0"); };
  const fmtDate = iso => new Date(iso).toLocaleString("es-CL",{dateStyle:"medium",timeStyle:"short"});
  function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600)}
  function colorFor(db){return db<=45?"green":db<=70?"yellow":"red"}
  function colorLabel(c){return c==="green"?"VERDE · Ambiente tranquilo":c==="yellow"?"AMARILLO · Moderar el volumen":"ROJO · Ruido elevado"}
  function updateLight(color){
    $("traffic").className="traffic "+color;
    $("levelName").textContent=colorLabel(color);
    $("statusPill").className="pill "+(running?"live":"neutral");
    $("statusPill").textContent=running?"Midiendo":"Detenido";
    $("hint").textContent=color==="green"?"Nivel dentro del rango tranquilo.":color==="yellow"?"El ruido está aumentando; intenten hablar más bajo.":"Nivel elevado; conviene reducir el ruido.";
  }
  function drawChart(){
    const canvas=$("chart"), rect=canvas.getBoundingClientRect(), dpr=window.devicePixelRatio||1;
    canvas.width=Math.max(300,Math.floor(rect.width*dpr));canvas.height=Math.floor(180*dpr);
    const ctx=canvas.getContext("2d"), w=canvas.width,h=canvas.height;
    ctx.clearRect(0,0,w,h);const pad=26*dpr, plotH=h-2*pad, plotW=w-2*pad;
    const y=v=>h-pad-(Math.max(0,Math.min(100,v))/100)*plotH;
    ctx.font=`${10*dpr}px system-ui`;ctx.textAlign="right";ctx.textBaseline="middle";
    [0,45,70,100].forEach(v=>{ctx.strokeStyle="#e2e8f0";ctx.lineWidth=dpr;ctx.beginPath();ctx.moveTo(pad,y(v));ctx.lineTo(w-pad,y(v));ctx.stroke();ctx.fillStyle="#64748b";ctx.fillText(v,pad-6*dpr,y(v));});
    if(samples.length<1){ctx.fillStyle="#94a3b8";ctx.textAlign="center";ctx.fillText("Las mediciones aparecerán aquí",w/2,h/2);return}
    const data=samples.slice(-180);ctx.beginPath();
    data.forEach((p,i)=>{const x=pad+(data.length===1?plotW/2:(i/(data.length-1))*plotW);i===0?ctx.moveTo(x,y(p.db)):ctx.lineTo(x,y(p.db));});
    ctx.strokeStyle="#0f766e";ctx.lineWidth=2.5*dpr;ctx.lineJoin="round";ctx.stroke();
    if(data.length===1){ctx.fillStyle="#0f766e";ctx.beginPath();ctx.arc(pad+plotW/2,y(data[0].db),3*dpr,0,Math.PI*2);ctx.fill()}
  }
  function updateStats(){
    const total=Math.max(0,elapsedMs), sum=times.green+times.yellow+times.red;
    $("elapsed").textContent=fmtTime(total);$("samples").textContent=sampleCount;
    $("average").textContent=sampleCount?(sumDb/sampleCount).toFixed(1)+" dB":"—";
    ["green","yellow","red"].forEach(c=>{
      const pct=sum?Math.round(times[c]/sum*100):0;
      $(c+"Time").textContent=fmtTime(times[c])+" · "+pct+"%";
      $(c+"Bar").style.width=pct+"%";
    });
    drawChart();
  }
  function measureDb(){
    const data=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);
    let squares=0;for(let i=0;i<data.length;i++)squares+=data[i]*data[i];
    const rms=Math.sqrt(squares/data.length);
    // dBFS + adjustable offset; this is an estimate, not calibrated SPL by default.
    const dbfs=20*Math.log10(Math.max(rms,1e-7));
    return Math.max(0,Math.min(120,dbfs+offset));
  }
  function tick(){
    if(!running)return;
    const now=Date.now(), delta=Math.min(1500,Math.max(0,now-lastTick));lastTick=now;
    elapsedMs=now-startedAt;
    if(lastDb!==null && delta>0) times[lastColor]+=delta;
    const db=measureDb(), color=colorFor(db);lastDb=db;lastColor=color;
    sampleCount++;sumDb+=db;minDb=Math.min(minDb,db);maxDb=Math.max(maxDb,db);
    samples.push({t:Math.round(elapsedMs/1000),db:Number(db.toFixed(1)),color});
    if(samples.length>3600)samples.shift();
    $("dbValue").textContent=db.toFixed(1);updateLight(color);updateStats();
  }
  async function start(){
    if(running)return;
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){toast("No se puede acceder al micrófono. Usa el APK o una página segura.");return}
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
      const AC=window.AudioContext||window.webkitAudioContext;audioContext=new AC();await audioContext.resume();
      analyser=audioContext.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=0;
      source=audioContext.createMediaStreamSource(stream);source.connect(analyser);
      running=true;startedAt=Date.now();lastTick=startedAt;elapsedMs=0;sampleCount=0;sumDb=0;minDb=Infinity;maxDb=-Infinity;
      times={green:0,yellow:0,red:0};samples=[];lastDb=null;lastColor="green";
      $("startBtn").disabled=true;$("stopBtn").disabled=false;$("saveBtn").disabled=true;$("saveMessage").textContent="Finaliza la medición para guardar esta sesión.";
      tick();interval=setInterval(tick,1000);toast("Medición iniciada");
    }catch(err){console.error(err);toast(err.name==="NotAllowedError"?"Permite el acceso al micrófono para comenzar.":"No se pudo iniciar el micrófono: "+err.message)}
  }
  function stop(){
    if(!running)return;
    // Account for the final interval without adding an extra sample.
    const now=Date.now(), delta=Math.min(1500,Math.max(0,now-lastTick));
    if(lastDb!==null)times[lastColor]+=delta;
    elapsedMs=now-startedAt;running=false;clearInterval(interval);interval=null;
    if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;
    if(audioContext){audioContext.close().catch(()=>{});audioContext=null}
    cancelAnimationFrame(raf);$("startBtn").disabled=false;$("stopBtn").disabled=true;$("saveBtn").disabled=sampleCount===0;
    $("statusPill").className="pill neutral";$("statusPill").textContent="Finalizado";
    $("hint").textContent="Sesión finalizada. Puedes guardarla en el historial.";
    updateStats();toast("Medición finalizada");
  }
  function sessionObject(){
    const total=times.green+times.yellow+times.red;
    return {id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),name:$("sessionName").value.trim()||"Sesión sin nombre",date:new Date().toISOString(),durationMs:elapsedMs,sampleCount,averageDb:sampleCount?Number((sumDb/sampleCount).toFixed(1)):null,minDb:Number.isFinite(minDb)?Number(minDb.toFixed(1)):null,maxDb:Number.isFinite(maxDb)?Number(maxDb.toFixed(1)):null,times:{...times},percentages:{green:total?Math.round(times.green/total*100):0,yellow:total?Math.round(times.yellow/total*100):0,red:total?Math.round(times.red/total*100):0},samples:samples.slice(),offset};
  }
  function readHistory(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]")}catch{return []}}
  function writeHistory(items){localStorage.setItem(STORAGE_KEY,JSON.stringify(items))}
  function save(){
    if(running||!sampleCount){toast("Primero finaliza una medición.");return}
    const s=sessionObject();const h=readHistory();h.unshift(s);
    try{writeHistory(h);lastSavedSession=s;renderHistory();$("saveBtn").disabled=true;$("saveMessage").textContent="Sesión guardada correctamente en este dispositivo.";toast("Sesión guardada")}
    catch(e){toast("No hay espacio suficiente para guardar. Exporta el historial y elimina sesiones antiguas.");console.error(e)}
  }
  function renderHistory(){
    const h=readHistory(), root=$("historyList");root.innerHTML="";
    if(!h.length){root.innerHTML='<p class="empty">Todavía no hay sesiones guardadas.</p>';return}
    h.forEach(s=>{
      const item=document.createElement("div");item.className="history-item";
      const info=document.createElement("div");info.className="history-info";
      const title=document.createElement("strong");title.textContent=s.name;
      const detail=document.createElement("small");detail.textContent=`${fmtDate(s.date)} · ${fmtTime(s.durationMs)} · Promedio ${s.averageDb??"—"} dB · V ${s.percentages?.green??0}% / A ${s.percentages?.yellow??0}% / R ${s.percentages?.red??0}%`;
      info.append(title,detail);
      const actions=document.createElement("div");actions.className="history-actions";
      const csv=document.createElement("button");csv.className="secondary";csv.textContent="CSV";csv.onclick=()=>downloadSessionCsv(s);
      const del=document.createElement("button");del.className="secondary";del.textContent="✕";del.setAttribute("aria-label","Eliminar sesión");del.onclick=()=>{if(confirm("¿Eliminar esta sesión?")){writeHistory(readHistory().filter(x=>x.id!==s.id));renderHistory()}};
      actions.append(csv,del);item.append(info,actions);root.append(item);
    });
  }
  function download(name,content,type="text/csv;charset=utf-8"){
    const blob=new Blob(["\ufeff"+content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function csvEscape(v){return '"'+String(v??"").replace(/"/g,'""')+'"'}
  function downloadSessionCsv(s){
    const rows=[["Fecha",s.date],["Nombre",s.name],["Duración (ms)",s.durationMs],["Muestras",s.sampleCount],["Promedio dB estimados",s.averageDb],["Mínimo dB estimados",s.minDb],["Máximo dB estimados",s.maxDb],["Tiempo verde (ms)",s.times.green],["Tiempo amarillo (ms)",s.times.yellow],["Tiempo rojo (ms)",s.times.red],[],["Segundo","dB estimados","Color"]];
    (s.samples||[]).forEach(p=>rows.push([p.t,p.db,p.color]));
    download("sonometro-"+s.id+".csv",rows.map(r=>r.map(csvEscape).join(",")).join("\n"));
  }
  $("startBtn").addEventListener("click",start);$("stopBtn").addEventListener("click",stop);$("saveBtn").addEventListener("click",save);
  $("applyOffset").addEventListener("click",()=>{const n=Number($("offset").value);if(!Number.isFinite(n)||n<0||n>160){toast("Introduce un ajuste entre 0 y 160 dB.");return}offset=n;localStorage.setItem("sonometro_offset",String(offset));toast("Ajuste aplicado: "+offset+" dB"});
  $("exportAllBtn").addEventListener("click",()=>{
    const h=readHistory();if(!h.length){toast("No hay sesiones para exportar.");return}
    const rows=[["id","nombre","fecha","duracion_ms","muestras","promedio_db_estimados","min_db_estimados","max_db_estimados","verde_ms","amarillo_ms","rojo_ms","verde_pct","amarillo_pct","rojo_pct"]];
    h.forEach(s=>rows.push([s.id,s.name,s.date,s.durationMs,s.sampleCount,s.averageDb,s.minDb,s.maxDb,s.times.green,s.times.yellow,s.times.red,s.percentages.green,s.percentages.yellow,s.percentages.red]));
    download("historial-sonometro-escolar.csv",rows.map(r=>r.map(csvEscape).join(",")).join("\n"));
  });
  $("clearHistoryBtn").addEventListener("click",()=>{if(confirm("¿Borrar permanentemente todas las sesiones guardadas en este dispositivo?")){writeHistory([]);renderHistory();toast("Historial borrado")}});
  window.addEventListener("resize",drawChart);
  window.addEventListener("beforeunload",()=>{if(stream)stream.getTracks().forEach(t=>t.stop())});
  updateLight("green");drawChart();renderHistory();
})();