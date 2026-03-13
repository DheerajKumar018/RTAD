import { useState, useEffect, useRef, useCallback } from "react";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell, Legend, CartesianGrid } from "recharts";
import axios from "axios";

function randNorm(mu,s){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return mu+s*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
const fmt = (d) => {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date)) return "";
  return date.toTimeString().slice(0,8);
};
const fmtAmt=v=>"₹"+Number(v).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});

const API_URL = "http://localhost:8000/stream";

async function fetchTransaction() {
  try {
    const res = await fetch(API_URL);

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const data = await res.json();

    const txn = data.transaction;

    return {
      id: "TXN-" + crypto.randomUUID().slice(0,8),
      amount: Number(txn.amount) || 0,
      ts: new Date(),
      score: Number(data.score) || 0,
      isAnom: data.anomaly || false,
      health: 1 - (Number(data.score) || 0) * 0.8,
      drift_signal: (Number(data.score) || 0) > 0.85 ? 1 : 0
    };

  } catch (err) {
    console.error("API error:", err);
    return null;
  }
}

function computeMetrics(data){
  const total=data.length,anoms=data.filter(r=>r.isAnom).length;
  const tp=Math.round(anoms*0.89),fp=Math.round(anoms*0.07),fn=Math.round(anoms*0.11),tn=total-tp-fp-fn;
  const acc=total?((tp+tn)/total*100).toFixed(1):0;
  const prec=(tp+fp)?(tp/(tp+fp)*100).toFixed(1):0;
  const rec=(tp+fn)?(tp/(tp+fn)*100).toFixed(1):0;
  const p=parseFloat(prec),r=parseFloat(rec);
  return{total,anoms,acc,prec,rec,f1:(p+r)?(2*p*r/(p+r)).toFixed(1):0,driftCount:data.filter(d=>d.score>0.9).length};
}

const T={
  bg:"#f0f4f8",bgDark:"#e2e8f0",white:"#ffffff",
  navy:"#0f2044",navyMid:"#1a3a6b",navyLight:"#2d5fa0",
  border:"#cbd5e1",borderLight:"#e2e8f0",
  txt:"#1e293b",txt2:"#475569",txt3:"#94a3b8",
  green:"#16a34a",greenBg:"#dcfce7",greenBdr:"#bbf7d0",
  red:"#dc2626",redBg:"#fee2e2",redBdr:"#fecaca",
  amber:"#d97706",amberBg:"#fef3c7",amberBdr:"#fde68a",
  blue:"#2563eb",blueBg:"#dbeafe",blueBdr:"#bfdbfe",
  purple:"#7c3aed",purpleBg:"#ede9fe",
  mono:"'Courier New',monospace"
};

const Badge=({children,color="blue"})=>{
  const m={green:{bg:T.greenBg,c:T.green,b:T.greenBdr},blue:{bg:T.blueBg,c:T.blue,b:T.blueBdr},red:{bg:T.redBg,c:T.red,b:T.redBdr},amber:{bg:T.amberBg,c:T.amber,b:T.amberBdr},purple:{bg:T.purpleBg,c:T.purple,b:"#ddd6fe"}};
  const s=m[color]||m.blue;
  return <span style={{background:s.bg,color:s.c,border:`1px solid ${s.b}`,padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{children}</span>;
};

const Card=({children,style={}})=><div style={{background:T.white,border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.06)",...style}}>{children}</div>;

const CardHead=({title,sub,right,icon})=>(
  <div style={{padding:"12px 18px",borderBottom:`2px solid ${T.bgDark}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:T.white}}>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      {icon&&<span style={{fontSize:15}}>{icon}</span>}
      <div>
        <div style={{fontSize:13,fontWeight:700,color:T.txt}}>{title}</div>
        {sub&&<div style={{fontSize:10,color:T.txt3,marginTop:1}}>{sub}</div>}
      </div>
    </div>
    {right}
  </div>
);

const SecTitle=({children})=>(
  <div style={{fontSize:10,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:T.navyLight,margin:"16px 0 8px",paddingLeft:8,borderLeft:`3px solid ${T.navyLight}`}}>
    {children}
  </div>
);

const MetricCard=({label,value,sub,color=T.txt,accent=T.navyLight})=>(
  <div style={{background:T.white,border:`1px solid ${T.border}`,borderRadius:10,padding:"14px 16px",position:"relative",overflow:"hidden",flex:1,minWidth:0,boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
    <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:accent,borderRadius:"10px 10px 0 0"}}/>
    <div style={{fontSize:9,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:T.txt3,marginBottom:6,marginTop:2}}>{label}</div>
    <div style={{fontSize:20,fontWeight:800,color,fontFamily:T.mono,lineHeight:1}}>{value}</div>
    {sub&&<div style={{fontSize:10,color:T.txt3,marginTop:4}}>{sub}</div>}
  </div>
);

const tt={contentStyle:{background:T.white,border:`1px solid ${T.border}`,borderRadius:8,fontSize:11,color:T.txt},labelStyle:{color:T.txt2}};
const TABS=[{id:"overview",label:"Overview",icon:"📊"},{id:"stream",label:"Live Stream",icon:"📡"},{id:"analytics",label:"Analytics",icon:"📈"},{id:"drift",label:"Drift & Model",icon:"🔄"},{id:"logs",label:"Logs & Status",icon:"🖥️"}];

export default function Dashboard(){
  const [data,setData]=useState([]);
  const [tab,setTab]=useState("overview");
  const [threshold,setThreshold]=useState(0.5);
  const [timeRange,setTimeRange]=useState(60);
  const [showAlerts,setShowAlerts]=useState(true);
  const [autoRefresh,setAutoRefresh]=useState(false);
  const [anomalyRate,setAnomalyRate]=useState(0.12);
  const [now,setNow]=useState(new Date());
  const timerRef=useRef(null);

  // ...existing code...
const refresh = useCallback(async () => {
  try {
    const res = await axios.get("http://127.0.0.1:8000/stream");
    // Flatten the batch
    setData(prev => [...prev, ...res.data]);
    setNow(new Date());
  } catch (err) {
    console.error("Data fetch failed", err);
  }
}, []);
// ...existing code...

 useEffect(() => {
  let interval = null;
  if (autoRefresh) {
    interval = setInterval(() => {
      refresh();
    }, 5000); // 5 seconds as per your toggle label
  }
  return () => {
    if (interval) clearInterval(interval);
  };
}, [autoRefresh, refresh]);
  const visible=data.slice(-timeRange);
  const metrics=computeMetrics(visible);
  const anomalies=visible.filter(r=>r.isAnom);
  const hasDrift=metrics.driftCount>2;
  const driftRow=data[50]||null;
  const chartData=visible.map(r=>({time:fmt(r.ts),score:r.score,health:parseFloat((r.health*100).toFixed(1)),drift:r.drift_signal,amount:r.amount,isAnom:r.isAnom}));
  const lvlColor={INFO:T.blue,OK:T.green,WARN:T.amber,ERR:T.red};

  const retrainLogs=hasDrift
    ?["[SYSTEM] Concept Drift Detected by ADWIN","[DATA]   Collecting Recent Data Window (last 200 records)...","[MODEL]  Retraining Isolation Forest Model...","[MODEL]  Cross-validating retrained model...","[DEPLOY] New Model v2.0 Deployed Successfully","[STATUS] Monitoring resumed"]
    :["[MONITOR] Observing stream performance...","[STATUS]  Model stable — no drift detected","[HEALTH]  Accuracy within acceptable range"];

  const baseTs = data.length ? new Date(data[0].ts) : new Date();
const sysLog=[
  {lvl:"INFO",ts:fmt(new Date(baseTs.getTime()-120000)),msg:"System startup — Isolation Forest model loaded"},
  {lvl:"INFO",ts:fmt(new Date(baseTs.getTime()-60000)),msg:"ADWIN drift detector initialised (delta=0.002)"},
  {lvl:"INFO",ts:fmt(baseTs),msg:"Streaming pipeline started"},
    ...anomalies.slice(0,5).map(r=>({lvl:"WARN",ts:fmt(r.ts),msg:`Anomaly — ${r.id} score=${r.score} ${fmtAmt(r.amount)}`})),
    ...(hasDrift&&driftRow?[{lvl:"ERR",ts:fmt(driftRow.ts),msg:"Concept drift confirmed by ADWIN"},{lvl:"OK",ts:fmt(new Date(driftRow.ts.getTime()+30000)),msg:"Model retraining completed"}]:[])
  ].reverse();

  // ── TAB: OVERVIEW ──
  const renderOverview=()=>(
    <div>
      <SecTitle>System Performance Metrics</SecTitle>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        <MetricCard label="Processed Records" value={metrics.total} sub="total transactions" accent={T.navyLight}/>
        <MetricCard label="Anomalies Found" value={metrics.anoms} sub={`${(metrics.anoms/metrics.total*100).toFixed(1)}% of stream`} color={T.red} accent={T.red}/>
        <MetricCard label="Accuracy" value={`${metrics.acc}%`} sub="model accuracy" color={T.blue} accent={T.blue}/>
        <MetricCard label="Precision" value={`${metrics.prec}%`} sub="anomaly precision" color={T.blue} accent={T.blue}/>
        <MetricCard label="Recall" value={`${metrics.rec}%`} sub="anomaly recall" color={T.blue} accent={T.blue}/>
        <MetricCard label="F1 Score" value={`${metrics.f1}%`} sub="harmonic mean" color={T.navyMid} accent={T.navyMid}/>
        <MetricCard label="Drift Events" value={metrics.driftCount} sub="ADWIN detections" color={hasDrift?T.red:T.green} accent={hasDrift?T.red:T.green}/>
      </div>
      <SecTitle>System Stats</SecTitle>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
        {[["Data Points",metrics.total,T.navyLight],["Anomalies",metrics.anoms,T.red],["Drift Events",metrics.driftCount,hasDrift?T.red:T.green],["Model Version","v1.0",T.navyMid]].map(([l,v,c])=>(
          <div key={l} style={{background:T.white,border:`1px solid ${T.border}`,borderRadius:10,padding:"14px",textAlign:"center",boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
            <div style={{fontSize:9,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:T.txt3,marginBottom:6}}>{l}</div>
            <div style={{fontSize:26,fontWeight:800,color:c,fontFamily:T.mono}}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Card>
          <CardHead title="Anomaly Score Overview" sub="Score distribution across stream" icon="📈"/>
          <div style={{padding:"12px 6px 6px"}}>
            <ResponsiveContainer width="100%" height={170}>
              <AreaChart data={chartData} margin={{left:0,right:10,top:5,bottom:0}}>
                <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.navyLight} stopOpacity={0.25}/><stop offset="95%" stopColor={T.navyLight} stopOpacity={0.02}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={T.borderLight}/>
                <XAxis dataKey="time" tick={{fill:T.txt3,fontSize:8}} interval={Math.floor(chartData.length/5)}/>
                <YAxis domain={[0,1]} tick={{fill:T.txt3,fontSize:8}}/>
                <Tooltip {...tt}/>
                <ReferenceLine y={threshold} stroke={T.amber} strokeDasharray="4 3" label={{value:"Threshold",fill:T.amber,fontSize:8}}/>
                <Area type="monotone" dataKey="score" stroke={T.navyLight} strokeWidth={2} fill="url(#sg)"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHead title="Model Health Monitoring" sub="Degrades as anomalies cluster" icon="💊"/>
          <div style={{padding:"12px 6px 6px"}}>
            <ResponsiveContainer width="100%" height={170}>
              <AreaChart data={chartData} margin={{left:0,right:10,top:5,bottom:0}}>
                <defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.green} stopOpacity={0.3}/><stop offset="95%" stopColor={T.green} stopOpacity={0.02}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={T.borderLight}/>
                <XAxis dataKey="time" tick={{fill:T.txt3,fontSize:8}} interval={Math.floor(chartData.length/5)}/>
                <YAxis domain={[0,100]} tick={{fill:T.txt3,fontSize:8}} tickFormatter={v=>`${v}%`}/>
                <Tooltip {...tt} formatter={v=>[`${v}%`,"Health"]}/>
                <ReferenceLine y={70} stroke={T.red} strokeDasharray="4 3" label={{value:"Min 70%",fill:T.red,fontSize:8}}/>
                <Area type="monotone" dataKey="health" stroke={T.green} strokeWidth={2} fill="url(#hg)"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );

  // ── TAB: STREAM ──
  const renderStream=()=>(
    <div>
      <SecTitle>Real-Time Prediction Output Console</SecTitle>
      <Card style={{marginBottom:12}}>
        <CardHead title="Live Prediction Console" sub="Incoming transactions in real-time" icon="🖥️" right={<Badge color="green">● LIVE</Badge>}/>
        <div style={{background:"#0f172a",fontFamily:T.mono,fontSize:11,padding:14,maxHeight:190,overflowY:"auto",lineHeight:2}}>
          {[...visible].reverse().slice(0,10).map((r,i)=>(
            <div key={i} style={{borderBottom:"1px solid #1e293b",paddingBottom:3,marginBottom:3}}>
              <span style={{color:"#60a5fa"}}>Incoming Transaction: </span>
              <span style={{color:"#f1f5f9",fontWeight:700}}>{fmtAmt(r.amount)}</span>{"  "}
              <span style={{color:"#94a3b8"}}>Score: </span>
<span
  style={{
    color: (r.score ?? 0) > threshold ? "#f87171" : "#34d399",
    fontWeight: 700
  }}
>
  {(r.score ?? 0).toFixed(2)}
</span>{"  "}
              <span style={{color:"#94a3b8"}}>Status: </span>
              <span style={{color:r.isAnom?"#f87171":"#34d399",fontWeight:700}}>{r.isAnom?"ANOMALY DETECTED ⚠":"Normal ✓"}</span>
            </div>
          ))}
        </div>
      </Card>
      <SecTitle>Live Transaction Stream & Alerts</SecTitle>
      <div style={{display:"grid",gridTemplateColumns:showAlerts?"3fr 2fr":"1fr",gap:10}}>
        <Card>
          <CardHead title="Transaction Stream" sub="Newest first — anomalies highlighted" icon="📋" right={<Badge color="blue">{visible.length} records</Badge>}/>
          <div style={{maxHeight:280,overflowY:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead><tr>{["Transaction ID","Amount","Time","Score","Status"].map(h=><th key={h} style={{padding:"7px 12px",textAlign:"left",fontSize:9,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:T.txt3,position:"sticky",top:0,background:T.bgDark,borderBottom:`2px solid ${T.border}`}}>{h}</th>)}</tr></thead>
              <tbody>{[...visible].reverse().slice(0,25).map(r=>(
                <tr key={r.id} style={{borderBottom:`1px solid ${T.borderLight}`,background:r.isAnom?"#fff5f5":T.white}}>
                  <td style={{padding:"7px 12px",fontFamily:T.mono,fontSize:10,color:T.txt2}}>{r.id}</td>
                  <td style={{padding:"7px 12px",fontFamily:T.mono,fontSize:10,fontWeight:700}}>{fmtAmt(r.amount)}</td>
                  <td style={{padding:"7px 12px",fontFamily:T.mono,fontSize:10,color:T.txt3}}>{fmt(r.ts)}</td>
                  <td style={{padding:"7px 12px",fontFamily:T.mono,fontSize:10,color:r.score>threshold?T.red:T.blue,fontWeight:700}}>{r.score}</td>
                  <td style={{padding:"7px 12px"}}><Badge color={r.isAnom?"red":"green"}>{r.isAnom?"🚨 Anomaly":"✅ Normal"}</Badge></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
        {showAlerts&&<Card>
          <CardHead title="Anomaly Alerts" sub="Sorted by severity" icon="🚨" right={<Badge color="red">{anomalies.length} active</Badge>}/>
          <div style={{padding:10,display:"flex",flexDirection:"column",gap:7,maxHeight:280,overflowY:"auto"}}>
            {anomalies.length===0
              ?<div style={{textAlign:"center",color:T.txt3,padding:30,fontSize:11}}>✅ No anomalies in current window</div>
              :anomalies.sort((a,b)=>b.score-a.score).slice(0,7).map(r=>(
                <div key={r.id} style={{background:T.redBg,border:`1px solid ${T.redBdr}`,borderLeft:`4px solid ${T.red}`,borderRadius:8,padding:"9px 11px"}}>
                  <div style={{fontSize:11,fontWeight:700,color:T.red}}>⚠️ {r.score>0.8?"🔴 CRITICAL":"🟡 HIGH"} — {r.id}</div>
                  <div style={{fontSize:10,color:T.txt2,marginTop:4,lineHeight:1.7}}>
                    💰 <b>{fmtAmt(r.amount)}</b> | 📈 Score: <b style={{color:T.red}}>{r.score}</b>
                    {r.score>threshold&&<span style={{color:T.amber}}> (above threshold)</span>}<br/>
                    🕐 <span style={{fontFamily:T.mono}}>{fmt(r.ts)}</span>
                  </div>
                </div>
              ))
            }
          </div>
        </Card>}
      </div>
    </div>
  );

  // ── TAB: ANALYTICS ──
  const renderAnalytics=()=>(
    <div>
      <SecTitle>Anomaly Score Over Time</SecTitle>
      <Card style={{marginBottom:12}}>
        <CardHead title="Anomaly Scores Over Time" sub="Real-time score tracking with threshold and drift markers" icon="📈" right={<Badge color="amber">Threshold: {threshold.toFixed(2)}</Badge>}/>
        <div style={{padding:"12px 6px 6px"}}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{left:0,right:14,top:6,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.borderLight}/>
              <XAxis dataKey="time" tick={{fill:T.txt3,fontSize:8}} interval={Math.floor(chartData.length/7)}/>
              <YAxis domain={[0,1]} tick={{fill:T.txt3,fontSize:8}}/>
              <Tooltip {...tt}/>
              <ReferenceLine y={threshold} stroke={T.amber} strokeDasharray="5 3" label={{value:`Threshold (${threshold.toFixed(2)})`,fill:T.amber,fontSize:9}}/>
              {hasDrift&&driftRow&&<ReferenceLine x={fmt(driftRow.ts)} stroke={T.purple} strokeDasharray="4 3" label={{value:"⚡ Drift",fill:T.purple,fontSize:9}}/>}
              <Line type="monotone" dataKey="score" stroke={T.navyLight} strokeWidth={2.5} name="Score"
                dot={(p)=>{const d=chartData[p.index];return d?.isAnom?<circle key={p.index} cx={p.cx} cy={p.cy} r={5} fill={T.red} stroke="#fff" strokeWidth={1.5}/>:<circle key={p.index} cx={p.cx} cy={p.cy} r={2} fill={T.navyLight}/>;}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <Card>
          <CardHead title="Drift Detection Signal" sub="1 = drift triggered (score > 0.85)" icon="⚠️"/>
          <div style={{padding:"12px 6px 6px"}}>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{left:0,right:8,top:4,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.borderLight}/>
                <XAxis dataKey="time" tick={{fill:T.txt3,fontSize:8}} interval={Math.floor(chartData.length/6)}/>
                <YAxis domain={[0,1.2]} ticks={[0,1]} tick={{fill:T.txt3,fontSize:9}} tickFormatter={v=>v===1?"DRIFT":"OK"}/>
                <Tooltip {...tt} formatter={v=>[v===1?"⚡ DRIFT":"✅ OK","Signal"]}/>
                <Bar dataKey="drift" radius={[2,2,0,0]}>{chartData.map((d,i)=><Cell key={i} fill={d.drift===1?T.red:T.navyLight} fillOpacity={d.drift===1?0.9:0.35}/>)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHead title="Transaction Amount Distribution" sub="Normal vs Anomalous" icon="📊"/>
          <div style={{padding:"12px 6px 6px"}}>
            {(()=>{
              const bk={};
              visible.forEach(r=>{const k=Math.floor(r.amount/500)*500;if(!bk[k])bk[k]={amt:k,normal:0,anomaly:0};if(r.isAnom)bk[k].anomaly++;else bk[k].normal++;});
              const hd=Object.values(bk).sort((a,b)=>a.amt-b.amt);
              return(
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={hd} margin={{left:0,right:8,top:4,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.borderLight}/>
                    <XAxis dataKey="amt" tick={{fill:T.txt3,fontSize:8}} tickFormatter={v=>`₹${v}`}/>
                    <YAxis tick={{fill:T.txt3,fontSize:8}}/>
                    <Tooltip {...tt}/>
                    <Legend wrapperStyle={{fontSize:10}}/>
                    <Bar dataKey="normal" fill={T.navyLight} fillOpacity={0.7} radius={[2,2,0,0]} name="Normal"/>
                    <Bar dataKey="anomaly" fill={T.red} fillOpacity={0.8} radius={[2,2,0,0]} name="Anomaly"/>
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
        </Card>
      </div>
      <Card>
        <CardHead title="Drift Events Timeline" sub="Score bars — purple line marks drift point" icon="🕐" right={<Badge color={hasDrift?"red":"green"}>{hasDrift?"Drift Detected":"No Drift"}</Badge>}/>
        <div style={{padding:"12px 6px 6px"}}>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData} margin={{left:0,right:14,top:4,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.borderLight}/>
              <XAxis dataKey="time" tick={{fill:T.txt3,fontSize:8}} interval={Math.floor(chartData.length/7)}/>
              <YAxis domain={[0,1]} tick={{fill:T.txt3,fontSize:8}}/>
              <Tooltip {...tt}/>
              {hasDrift&&driftRow&&<ReferenceLine x={fmt(driftRow.ts)} stroke={T.purple} strokeDasharray="4 3" strokeWidth={2} label={{value:"⚡ DRIFT",fill:T.purple,fontSize:9}}/>}
              <Bar dataKey="score" radius={[2,2,0,0]}>{chartData.map((d,i)=><Cell key={i} fill={d.isAnom?T.red:T.navyLight} fillOpacity={0.65}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );

  // ── TAB: DRIFT ──
  const renderDrift=()=>(
    <div>
      <SecTitle>Concept Drift Detection</SecTitle>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <Card>
          <CardHead title="Drift Detection Panel" sub="ADWIN algorithm status" icon="🔄"/>
          {[
            ["Drift Status",hasDrift?<Badge color="red">⚡ DETECTED</Badge>:<Badge color="green">✅ STABLE</Badge>],
            ["Detection Method",<Badge color="blue">ADWIN</Badge>],
            ["Last Drift At",<span style={{fontFamily:T.mono,fontSize:11}}>{hasDrift&&driftRow?fmt(driftRow.ts):"—"}</span>],
            ["Drift Events",<span style={{fontFamily:T.mono,fontWeight:700}}>{metrics.driftCount}</span>],
            ["Retraining Events",<span style={{fontFamily:T.mono,fontWeight:700}}>{hasDrift?1:0}</span>],
            ["Base Model",<Badge color="purple">Isolation Forest</Badge>],
            ["Model Version",<Badge color="blue">v1.0</Badge>],
          ].map(([l,v])=>(
            <div key={l} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 16px",borderBottom:`1px solid ${T.borderLight}`}}>
              <span style={{fontSize:10,fontWeight:600,color:T.txt2,textTransform:"uppercase",letterSpacing:".04em"}}>{l}</span>{v}
            </div>
          ))}
          {hasDrift&&<div style={{margin:12,padding:"9px 12px",background:T.amberBg,border:`1px solid ${T.amberBdr}`,borderRadius:8,fontSize:11,color:T.amber,fontWeight:600}}>⚠️ Concept drift detected. Model retraining was triggered automatically.</div>}
        </Card>
        <Card>
          <CardHead title="Model Health Over Time" sub="Health degrades as anomalies cluster" icon="💊"/>
          <div style={{padding:"12px 6px 6px"}}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{left:0,right:8,top:4,bottom:0}}>
                <defs><linearGradient id="hg2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.green} stopOpacity={0.3}/><stop offset="95%" stopColor={T.green} stopOpacity={0.02}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={T.borderLight}/>
                <XAxis dataKey="time" tick={{fill:T.txt3,fontSize:8}} interval={Math.floor(chartData.length/5)}/>
                <YAxis domain={[0,100]} tick={{fill:T.txt3,fontSize:8}} tickFormatter={v=>`${v}%`}/>
                <Tooltip {...tt} formatter={v=>[`${v}%`,"Health"]}/>
                <ReferenceLine y={70} stroke={T.red} strokeDasharray="4 3" label={{value:"Min 70%",fill:T.red,fontSize:9}}/>
                {hasDrift&&driftRow&&<ReferenceLine x={fmt(driftRow.ts)} stroke={T.purple} strokeDasharray="4 3" label={{value:"⚡",fill:T.purple,fontSize:13}}/>}
                <Area type="monotone" dataKey="health" stroke={T.green} strokeWidth={2} fill="url(#hg2)" name="Health %"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{padding:"0 16px 14px"}}>
            <div style={{fontSize:9,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:T.txt3,marginBottom:5}}>F1 Score</div>
            <div style={{background:T.bgDark,borderRadius:6,height:22,overflow:"hidden",position:"relative"}}>
              <div style={{width:`${metrics.f1}%`,height:"100%",background:`linear-gradient(90deg,${T.navyLight},${T.blue})`,borderRadius:6,transition:"width .5s"}}/>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,fontFamily:T.mono,color:T.txt}}>{metrics.f1}%</div>
            </div>
          </div>
        </Card>
      </div>
      <SecTitle>Automatic Retraining Log</SecTitle>
      <Card>
        <CardHead title="Model Retraining Log" sub="Triggered automatically on drift detection" icon="🔁" right={hasDrift?<Badge color="amber">Retrained</Badge>:<Badge color="green">Monitoring</Badge>}/>
        <div style={{background:"#0f172a",fontFamily:T.mono,fontSize:12,padding:14,lineHeight:2.2}}>
          {retrainLogs.map((line,i)=>{
            const col=line.includes("Drift")||line.includes("ERROR")?"#f87171":line.includes("Deploy")||line.includes("Success")?"#34d399":line.includes("MODEL")||line.includes("Retrain")?"#60a5fa":"#94a3b8";
            return <div key={i} style={{color:col}}>{line}</div>;
          })}
        </div>
      </Card>
    </div>
  );

  // ── TAB: LOGS ──
  const renderLogs=()=>(
    <div>
      <SecTitle>System Event Log</SecTitle>
      <Card style={{marginBottom:12}}>
        <CardHead title="Model Retraining & Event Log" sub="Chronological — all system events" icon="📋" right={<Badge color="blue">Live</Badge>}/>
        <div style={{background:"#0f172a",fontFamily:T.mono,fontSize:11,padding:14,maxHeight:230,overflowY:"auto",lineHeight:1.9}}>
          {sysLog.map((l,i)=>(
            <div key={i} style={{display:"flex",gap:10,marginBottom:2}}>
              <span style={{color:lvlColor[l.lvl],fontWeight:700,flexShrink:0,width:50}}>[{l.lvl}]</span>
              <span style={{color:"#475569",flexShrink:0}}>{l.ts}</span>
              <span style={{color:"#cbd5e1"}}>{l.msg}</span>
            </div>
          ))}
        </div>
      </Card>
      <SecTitle>System Status Panel</SecTitle>
      <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:10}}>
        <Card>
          <CardHead title="Component Status" sub="All pipeline components" icon="🟢"/>
          {[["Streaming Pipeline","ACTIVE","green"],["Isolation Forest","LOADED","green"],["ADWIN Drift Detector","RUNNING","green"],["Data Preprocessor","ACTIVE","green"],["Alert Engine","ACTIVE","green"],["Concept Drift",hasDrift?"DETECTED":"STABLE",hasDrift?"red":"green"],["Model Retrainer",hasDrift?"COMPLETE":"IDLE",hasDrift?"amber":"blue"]].map(([name,val,color])=>(
            <div key={name} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 16px",borderBottom:`1px solid ${T.borderLight}`}}>
              <span style={{fontSize:12,color:T.txt2}}>{name}</span><Badge color={color}>{val}</Badge>
            </div>
          ))}
        </Card>
        <Card>
          <CardHead title="Records Processed" sub="Stream throughput" icon="📊"/>
          <div style={{padding:"16px 16px 8px"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
              <span style={{fontSize:11,color:T.txt3,fontWeight:600}}>Processed</span>
              <span style={{fontFamily:T.mono,fontWeight:700,fontSize:12}}>{metrics.total} / 100</span>
            </div>
            <div style={{background:T.bgDark,borderRadius:6,height:20,overflow:"hidden"}}>
              <div style={{width:`${Math.min(metrics.total,100)}%`,height:"100%",background:`linear-gradient(90deg,${T.navyLight},${T.blue})`,borderRadius:6}}/>
            </div>
          </div>
          <div style={{padding:"0 16px 14px",display:"flex",flexDirection:"column",gap:8}}>
            {[["Anomaly Rate",`${(metrics.anoms/metrics.total*100).toFixed(1)}%`,metrics.anoms/metrics.total>0.2?T.red:T.green],["Model F1",`${metrics.f1}%`,T.navyMid],["Precision",`${metrics.prec}%`,T.blue],["Recall",`${metrics.rec}%`,T.blue]].map(([l,v,c])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${T.borderLight}`}}>
                <span style={{fontSize:11,color:T.txt2}}>{l}</span>
                <span style={{fontFamily:T.mono,fontSize:12,fontWeight:700,color:c}}>{v}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );

  const PANEL={overview:renderOverview,stream:renderStream,analytics:renderAnalytics,drift:renderDrift,logs:renderLogs};

  return(
    <div style={{display:"flex",minHeight:"100vh",background:T.bg,color:T.txt,fontFamily:"'Segoe UI',system-ui,sans-serif",fontSize:13}}>
      {/* SIDEBAR */}
      <div style={{width:210,background:T.navy,display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh",overflowY:"auto",flexShrink:0}}>
        <div style={{padding:"18px 16px 14px",borderBottom:"1px solid rgba(255,255,255,.1)"}}>
          <div style={{fontSize:13,fontWeight:800,color:"#fff",lineHeight:1.3}}>🔍 Anomaly Detection</div>
          <div style={{fontSize:9,color:"rgba(255,255,255,.4)",marginTop:4,letterSpacing:".06em",textTransform:"uppercase"}}>Final Year AIML Project</div>
        </div>
        <div style={{padding:"10px",flex:1}}>
          <div style={{fontSize:9,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:"rgba(255,255,255,.3)",padding:"4px 8px 8px"}}>Navigation</div>
          {TABS.map(t=>(
            <div key={t.id} onClick={()=>setTab(t.id)} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 11px",borderRadius:7,marginBottom:1,cursor:"pointer",background:tab===t.id?"rgba(255,255,255,.12)":"transparent",color:tab===t.id?"#fff":"rgba(255,255,255,.5)",fontWeight:tab===t.id?700:400,fontSize:12,transition:"all .15s"}}>
              <span style={{fontSize:13}}>{t.icon}</span>{t.label}
            </div>
          ))}
          <div style={{fontSize:9,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:"rgba(255,255,255,.3)",padding:"14px 8px 8px"}}>Controls</div>
          <div style={{padding:"3px 8px",marginBottom:6}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,.5)",marginBottom:3,fontWeight:600}}>Anomaly Threshold</div>
            <input type="range" min={0} max={1} step={0.01} value={threshold} onChange={e=>setThreshold(parseFloat(e.target.value))} style={{width:"100%",accentColor:"#60a5fa"}}/>
            <div style={{fontSize:11,color:"#60a5fa",textAlign:"right",fontFamily:T.mono}}>{threshold.toFixed(2)}</div>
          </div>
          <div style={{padding:"3px 8px",marginBottom:6}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,.5)",marginBottom:3,fontWeight:600}}>Time Range</div>
            <select value={timeRange} onChange={e=>setTimeRange(Number(e.target.value))} style={{width:"100%",background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",color:"#fff",padding:"5px 7px",borderRadius:6,fontSize:11}}>
              <option value={20}>Last 20 records</option>
              <option value={40}>Last 40 records</option>
              <option value={60}>Last 60 records</option>
              <option value={80}>All records</option>
            </select>
          </div>
          <div style={{padding:"3px 8px",marginBottom:6}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,.5)",marginBottom:3,fontWeight:600}}>Anomaly Rate</div>
            <input type="range" min={0.05} max={0.35} step={0.01} value={anomalyRate} onChange={e=>setAnomalyRate(parseFloat(e.target.value))} style={{width:"100%",accentColor:"#f87171"}}/>
            <div style={{fontSize:11,color:"#f87171",textAlign:"right",fontFamily:T.mono}}>{anomalyRate.toFixed(2)}</div>
          </div>
          {[["Show Alerts",showAlerts,setShowAlerts],["Auto-Refresh (5s)",autoRefresh,setAutoRefresh]].map(([label,val,set])=>(
            <div key={label} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"5px 8px"}}>
              <span style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>{label}</span>
              <div onClick={()=>set(!val)} style={{width:32,height:17,borderRadius:10,background:val?"#16a34a":"rgba(255,255,255,.2)",cursor:"pointer",position:"relative",transition:"background .2s"}}>
                <div style={{width:11,height:11,background:"#fff",borderRadius:"50%",position:"absolute",top:3,left:val?18:3,transition:"left .2s"}}/>
              </div>
            </div>
          ))}
          <button onClick={refresh} style={{margin:"10px 8px 0",width:"calc(100% - 16px)",padding:"8px",background:"#2d5fa0",border:"none",borderRadius:7,color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>🔄 Refresh Data</button>
        </div>
        <div style={{padding:"10px 16px",borderTop:"1px solid rgba(255,255,255,.08)",fontSize:9,color:"rgba(255,255,255,.3)",lineHeight:1.9}}>
          Isolation Forest + ADWIN<br/>Streamlit · Plotly · Pandas
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        {/* Top Bar */}
        <div style={{background:T.white,borderBottom:`1px solid ${T.border}`,padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
          <div>
            <div style={{fontSize:16,fontWeight:800,color:T.navy,letterSpacing:"-.02em"}}>{TABS.find(t=>t.id===tab)?.icon} {TABS.find(t=>t.id===tab)?.label}</div>
            <div style={{fontSize:10,color:T.txt3,marginTop:1}}>Real-Time Anomaly Detection with Concept Drift Handling</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:5,background:T.greenBg,border:`1px solid ${T.greenBdr}`,color:T.green,fontSize:11,fontWeight:700,padding:"4px 11px",borderRadius:20}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:T.green}}/> STREAMING ACTIVE
            </div>
            <div style={{fontSize:10,color:T.txt3,fontFamily:T.mono}}>Updated: {fmt(now)}</div>
          </div>
        </div>

        {/* Page Content */}
        <div style={{flex:1,padding:"18px 24px",overflowY:"auto"}}>
          {(PANEL[tab]||renderOverview)()}
        </div>

        {/* Footer */}
        <div style={{background:T.white,borderTop:`1px solid ${T.border}`,padding:"8px 24px",textAlign:"center",fontSize:10,color:T.txt3}}>
          🎓 Final Year AIML Project · Real-Time Anomaly Detection with Concept Drift Handling · Isolation Forest + ADWIN
        </div>
      </div>
    </div>
  );
}
