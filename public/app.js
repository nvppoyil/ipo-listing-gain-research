
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='ipo-verdict-ui-v1';
const seed=[
{name:'Jio Platforms',price:1119,list:'28 Oct 2026',kostak:null,gmp:[{d:'2026-10-04',v:148},{d:'2026-10-09',v:167},{d:'2026-10-15',v:223},{d:'2026-10-16',v:225},{d:'2026-10-19',v:252},{d:'2026-10-23',v:245}],sub:{total:21.36,qib:67.15,nii:13.99,retail:2.76},fund:{},mood:null},
{name:'Strong case',demo:1,price:200,list:'TBA',gmp:[{d:'2026-10-20',v:48},{d:'2026-10-23',v:62}],sub:{total:84,qib:120,nii:90,retail:30},fund:{g:32,pe:.9,de:.3},mood:'strong'},
{name:'Weak case',demo:1,price:150,list:'TBA',gmp:[{d:'2026-10-20',v:6},{d:'2026-10-23',v:-4}],sub:{total:1.4,qib:.9,nii:1.2,retail:2},fund:{g:-8,pe:1.8,de:2.1},mood:'weak'}];
let ipos=seed,sel=0;
try{const s=JSON.parse(localStorage.getItem(KEY));if(Array.isArray(s)&&s.length)ipos=s}catch(e){}
try{const t=localStorage.getItem('ipo-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(ipos))}catch(e){}};

// Scoring modules
const mGmp=i=>{const m={name:'Grey market (GMP)',max:5,notes:[],need:'gmp'},h=[...(i.gmp||[])].sort((a,b)=>a.d<b.d?-1:1);
 if(!h.length||!i.price){m.scored=false;m.points=0;m.notes.push('No GMP entered yet.');return m}
 const L=h[h.length-1].v,p=L/i.price*100;let pt=p>=25?4:p>=15?3:p>=8?2:p>=0?1:-3,t='flat';
 if(h.length>1){const q=h[h.length-2].v;if(L>q*1.05){t='rising';pt++}else if(L<q*.95){t='falling';pt--}}
 m.notes.push(`GMP ₹${L} is ${p.toFixed(1)}% over the issue price`,`Indicative listing price ₹${i.price+L}`,`Trend against the last reading: ${t}`);
 if(i.kostak!=null)m.notes.push(`Kostak ₹${i.kostak}`);
 return Object.assign(m,{scored:true,points:pt,pct:p,hist:h})};
const mSub=s=>{const m={name:'Subscription',max:3,notes:[],need:'total'};
 if(!s||s.total==null){m.scored=false;m.points=0;m.notes.push('No subscription data yet.');return m}
 let pt=s.total>=50?2:s.total>=10?1:s.total>=3?0:-2;m.notes.push(`Total ${s.total}x`);
 if(s.qib!=null){m.notes.push(`Institutions (QIB) ${s.qib}x`);if(s.qib>=20)pt++;else if(s.qib<2)pt--}
 if(s.nii!=null)m.notes.push(`HNI (NII) ${s.nii}x`);
 if(s.retail!=null){m.notes.push(`Retail ${s.retail}x`);if(s.retail>1)m.notes.push(`Allotment is a lottery, roughly ${(100/s.retail).toFixed(0)}% odds per application`)}
 return Object.assign(m,{scored:true,points:pt})};
const mFund=f=>{f=f||{};const m={name:'Company fundamentals',max:0,points:0,notes:[],need:'growth'};
 const add=(x,p,n)=>{m.max+=x;m.points+=p;m.notes.push(n)};
 if(f.g!=null)add(2,f.g>20?2:f.g>=0?1:-2,`Profit growth ${f.g}% a year`);
 if(f.pe!=null)add(1,f.pe<=1?1:f.pe>1.5?-2:0,`Valuation ${f.pe}x peer P/E`);
 if(f.de!=null)add(1,f.de<.5?1:f.de>1.5?-1:0,`Debt-to-equity ${f.de}`);
 m.scored=m.max>0;if(!m.scored){m.max=4;m.notes.push('Not entered. Take these from the prospectus (RHP).')}return m};
const mMood=v=>{const o={strong:1,neutral:0,weak:-1},m={name:'Market mood',max:1,need:'mood'};
 if(!(v in o)){m.scored=false;m.points=0;m.notes=['Not set. Check the Nifty trend and FII flows this week.'];return m}
 return Object.assign(m,{scored:true,points:o[v],notes:[`Market mood is ${v}`]})};
function decide(mods){const s=mods.filter(m=>m.scored),pt=s.reduce((a,m)=>a+m.points,0),mx=s.reduce((a,m)=>a+m.max,0),ratio=mx?pt/mx:0,g=mods[0],pct=g.scored?g.pct:null,conf=s.length>=4?'High':s.length==3?'Medium':'Low';let v,t;
 if(!s.length){v='NO DATA';t='Enter GMP and subscription numbers to get a verdict.'}
 else if((pct!==null&&pct<=-5)||ratio<=.25){v='BAD';t='The signals are weak. This sits in your 15% loss risk zone.'}
 else if(pct!==null&&pct>=25&&ratio>=.6){v='GOOD';t=`Grey market is ${pct.toFixed(1)}% and the other numbers back it up. This meets your 25% target on paper, with no guarantee.`}
 else{v='NEUTRAL';t='It doesn’t clear the good bar (GMP of 25% or more and a strong score), and it isn’t weak enough to call bad.'}
 return{v,t,pt,mx,conf,n:s.length}}
const ev=i=>{const mods=[mGmp(i),mSub(i.sub),mFund(i.fund),mMood(i.mood)];return{mods,...decide(mods)}};
const C={GOOD:'good',BAD:'bad',NEUTRAL:'neu','NO DATA':'no'},L={GOOD:'Good',BAD:'Bad',NEUTRAL:'Neutral','NO DATA':'No data'};

// Views
const ruler=p=>{const pos=x=>(Math.max(-20,Math.min(40,x))+20)/60*100,m=pos(p),lp=Math.max(8,Math.min(92,m));
 return `<div class="ruler"><span class="pill" style="left:${lp}%">${p.toFixed(1)}%</span><div class="track"><div class="zones"><i class="z1"></i><i class="z2"></i><i class="z3"></i></div><b class="mk" style="left:${m}%"></b></div>
 <div class="ticks"><span style="left:0">−20%</span><span style="left:25%">−5% loss risk</span><span style="left:75%">25% target</span><span style="left:100%">40%</span></div></div>`};
const spark=h=>{if(h.length<2)return'';const v=h.map(x=>x.v),a=Math.min(...v),b=Math.max(...v),r=b-a||1;
 const pts=v.map((y,k)=>`${(k/(v.length-1)*200).toFixed(1)},${(44-(y-a)/r*40).toFixed(1)}`).join(' ');
 return `<svg class="spark" viewBox="0 0 200 48" preserveAspectRatio="none" role="img" aria-label="GMP history from ₹${v[0]} to ₹${v[v.length-1]}"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg>`};
function renderList(){$('#list').innerHTML=ipos.map((i,n)=>{const r=ev(i),g=r.mods[0];
 return `<button class="item${n==sel?' on':''}" data-n="${n}"><span class="dot ${C[r.v]}"></span><span class="nm">${esc(i.name)}${i.demo?'<small>demo</small>':''}</span><span class="st"><b class="${C[r.v]}">${L[r.v]}</b>${g.scored?'GMP '+g.pct.toFixed(1)+'%':'No GMP'}</span></button>`}).join('')}
function renderRep(){const i=ipos[sel];if(!i){$('#rep').innerHTML='<p>Add an IPO to get started.</p>';return}
 const r=ev(i),g=r.mods[0];
 $('#rep').innerHTML=`<section class="hero"><div><h2>${esc(i.name)}, upper band ₹${i.price}, listing ${esc(i.list||'TBA')}</h2>
 <div class="vw ${C[r.v]}">${L[r.v]}</div><p>${esc(r.t)}</p><div class="conf">Confidence ${r.conf}. ${r.n} of 4 checks have data. Score ${r.pt} of ${r.mx}.</div></div>
 <button class="btn upd" data-f="">Update data</button></section>
 ${g.scored?`<section class="sec"><h3>Where the grey market points</h3><p class="hint">Your bars: a gain of 25% or more is good, a loss of 15% is the risk.</p>${ruler(g.pct)}</section>`:''}
 <section class="sec" style="margin-top:6px"><h3>What the score is made of</h3>
 ${r.mods.map(m=>{const w=m.scored?Math.min(100,Math.abs(m.points)/m.max*100):0;
  return `<div class="mod${m.scored?'':' off'}"><div><h4>${m.name}</h4><ul>${m.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>${m.hist?spark(m.hist):''}${m.scored?'':`<button class="need upd" data-f="${m.need}">Add data</button>`}</div>
  <div><div class="sc">${m.scored?m.points+' of '+m.max:'Not scored'}</div><div class="bar${m.points<0?' neg':''}"><i style="width:${w}%"></i></div></div></div>`}).join('')}</section>
 <details><summary>How the verdict is decided</summary>
 <ul><li>Good: grey market is 25% or more over the issue price and the overall score is 60% or higher.</li>
 <li>Bad: grey market is −5% or lower, or the overall score is 25% or lower.</li>
 <li>Neutral: everything in between.</li>
 <li>Only checks with data count. Fewer checks means lower confidence.</li></ul></details>`}
const render=()=>{renderList();renderRep()};

// Form
const dlg=$('#dlg'),num=id=>{const v=$('#f-'+id).value;return v===''?null:Number(v)};
function openForm(edit,focus){$('#f').reset();const i=ipos[sel];
 if(edit&&i){$('#dt').textContent='Update '+i.name;$('#f-name').value=i.name;$('#f-price').value=i.price}else $('#dt').textContent='Add an IPO';
 dlg.showModal();const t=$('#f-'+(focus||(edit?'gmp':'name')));if(t)t.focus()}
$('#f').onsubmit=e=>{e.preventDefault();const name=$('#f-name').value.trim(),price=num('price');if(!name||!price)return;
 let k=ipos.findIndex(p=>p.name.toLowerCase()===name.toLowerCase());
 if(k<0){ipos.push({name,price,list:'TBA',gmp:[],sub:{},fund:{},mood:null});k=ipos.length-1}
 const i=ipos[k];i.price=price;i.gmp=i.gmp||[];i.sub=i.sub||{};i.fund=i.fund||{};
 const g=num('gmp');if(g!==null){const d=new Date().toISOString().slice(0,10),s=i.gmp.find(x=>x.d===d);s?s.v=g:i.gmp.push({d,v:g})}
 const set=(o,key,id)=>{const x=num(id);if(x!==null)o[key]=x};
 set(i,'kostak','kostak');set(i.sub,'total','total');set(i.sub,'qib','qib');set(i.sub,'nii','nii');set(i.sub,'retail','retail');
 set(i.fund,'g','growth');set(i.fund,'pe','pe');set(i.fund,'de','de');
 const m=$('#f-mood').value;if(m)i.mood=m;
 sel=k;save();dlg.close();render()};
$('#cx').onclick=()=>dlg.close();
$('#add').onclick=()=>openForm(false);
$('#th').onclick=()=>{const d=document.documentElement,dark=d.dataset.theme?d.dataset.theme==='dark':matchMedia('(prefers-color-scheme:dark)').matches,n=dark?'light':'dark';d.dataset.theme=n;try{localStorage.setItem('ipo-theme',n)}catch(e){}};
document.addEventListener('click',e=>{const it=e.target.closest('.item');if(it){sel=+it.dataset.n;render();return}
 const u=e.target.closest('.upd');if(u)openForm(true,u.dataset.f||'gmp')});
render();

// Pipeline: snapshot of SEBI RHP filings plus broker/news dates, checked 25 Oct 2026
const S='https://www.sebi.gov.in/filings/public-issues/oct-2026/',D='https://www.sebi.gov.in/sebi_data/commondocs/oct-2026/';
let P=[
{g:'open',name:'SFC Environmental Technologies',state:'Opens 27 Oct',open:'27 Oct',close:'29 Oct',band:'₹313 to ₹330',lot:'45 shares (₹14,850)',size:'₹668 crore, ₹150 crore fresh',list:'3 Nov',price:330,gmp:[{d:'2026-10-21',v:31},{d:'2026-10-22',v:20},{d:'2026-10-23',v:21},{d:'2026-10-24',v:21},{d:'2026-10-25',v:32}],asof:'25 Oct 2026, about 1:45 pm',srcs:'IPO Market, InvestorGain, IPO Ji, IPO Watch',warn:'Trackers disagree. Some still showed ₹21 on 24 Oct, others ₹32 on 25 Oct. Bidding has not opened, so there is no subscription data.',note:'Wastewater treatment, Navi Mumbai. Allotment 30 Oct. RHP filed with SEBI on 22 Oct. No GMP quote yet as of 21 Oct.',rhp:S+'sfc-environmental-technologies-ltd-rhp_105380.html',ap:D+'SFC%20Environmental%20Technologies%20Ltd.%20%20-%20Abridged%20Prospectus_p.pdf'},
{g:'open',name:'BLS Polymers',state:'Opens 27 Oct',open:'27 Oct',close:'29 Oct',band:'₹142 to ₹150',lot:'100 shares (₹15,000)',size:'₹255 crore, all fresh issue',list:'3 Nov',price:150,gmp:[{d:'2026-10-19',v:20},{d:'2026-10-20',v:30},{d:'2026-10-21',v:30},{d:'2026-10-22',v:35},{d:'2026-10-23',v:38},{d:'2026-10-25',v:38}],fund:{g:27.8,de:.54},asof:'25 Oct 2026, about 10 am',srcs:'InvestorGain, IPO Watch, Be IPO Ready, IPO Premium',facts:['Profit after tax ₹27.0 crore in FY26, up from ₹21.1 crore in FY25 (about 28%)','Borrowings ₹51.7 crore against net worth ₹94.9 crore at March 2026','Post-issue P/E about 22.7. Peer P/E was not available, so valuation is not scored'],warn:'GMP sits right at your 25% bar, so a small fall flips the verdict. Bidding has not opened, so there is no subscription data.',note:'Anchor book 26 Oct, allotment 30 Oct. RHP filed 19 Oct. GMP was ₹20 (about 13%) on 19 Oct.',rhp:S+'bls-polymers-limited-rhp_105327.html',ap:D+'BLS%20Polymers%20Limited_p.pdf'},
{g:'wait',name:'Paras Healthcare',state:'Closed 23 Oct',open:'21 Oct',close:'23 Oct',band:'₹660 to ₹693',lot:'21 shares (₹14,553)',size:'₹1,450 crore, ₹500 crore fresh',list:'28 Oct',price:693,gmp:[{d:'2026-10-15',v:111},{d:'2026-10-17',v:96},{d:'2026-10-20',v:78},{d:'2026-10-21',v:40}],asof:'21 Oct 2026 (latest dated reading found)',srcs:'InvestorGain, IPO Ji, Finowings',warn:'This data is stale. GMP fell from ₹111 to ₹40 by 21 Oct, and one tracker shows an undated ₹70. The final subscription was not found. Check the live GMP before acting.',note:'Hospital chain, Gurugram. Allotment 26 Oct. Earnings per share turned positive only in FY26, so the P/E at the band is above 150.',rhp:S+'paras-healthcare-limited-rhp_105284.html',ap:D+'Paras%20Healthcare%20Limited_p.pdf'},
{g:'wait',name:'Jio Platforms',state:'Closed 23 Oct',open:'21 Oct',close:'23 Oct',band:'₹1,065 to ₹1,119',lot:'12 shares',size:'₹30,213 crore',list:'28 Oct',price:1119,gmp:[{d:'2026-10-04',v:148},{d:'2026-10-09',v:167},{d:'2026-10-15',v:223},{d:'2026-10-16',v:225},{d:'2026-10-19',v:252},{d:'2026-10-23',v:245}],sub:{total:21.36,qib:67.15,nii:13.99,retail:2.76},asof:'23 Oct 2026 (last reading found)',srcs:'IIFL, Chittorgarh, Upstox',note:'Final subscription about 21x. Already scored under My verdicts.',rhp:S+'jio-platforms-limited-rhp_105274.html'},
{g:'pipe',name:'Avaada Electro',state:'No dates yet',size:'₹7,600 crore (reported)',note:'Roadshows have started. Fresh issue plus offer for sale.'},
{g:'pipe',name:'Upstox',state:'No dates yet',note:'Listed as upcoming by Zerodha. Dates to be announced.'},
{g:'pipe',name:'Inox Clean Energy',state:'No dates yet',note:'Listed as upcoming by Zerodha. Dates to be announced.'},
{g:'pipe',name:'Tata Sons',state:'No dates yet',note:'Listed as upcoming by Zerodha. Dates to be announced.'}];
const GL={open:['Opens this week','You can still apply. Dates and bands come from broker and news pages, so confirm them on NSE or BSE before bidding.'],wait:['Closed, waiting to list','Bidding is over. Check allotment and listing dates on each card.'],pipe:['In the pipeline, no dates yet','From news and broker lists. Not priced yet, so treat as unconfirmed.']};
const row=(p,n)=>`<article class="pr"><div class="pt"><h4>${esc(p.name)}</h4><span class="pill2">${esc(p.state)}</span></div>
<dl class="pd">${[['Bidding',p.open?p.open+' to '+p.close:'To be announced'],['Price band',p.band||'To be announced'],['Lot',p.lot||'To be announced'],['Issue size',p.size||'To be announced'],['Listing',p.list||'To be announced']].map(a=>`<div><dt>${a[0]}</dt><dd>${esc(a[1])}</dd></div>`).join('')}</dl>
<p class="note">${esc(p.note||'')}</p>
<div class="pa">${p.gmp&&p.price?`<button class="btn p ck" data-i="${n}">Check GMP and chances</button>`:''}<button class="btn rs" data-i="${n}">Copy research request</button>${p.price?`<button class="btn av" data-i="${n}">Add to my verdicts</button>`:''}${p.rhp?`<a href="${p.rhp}" target="_blank" rel="noopener">SEBI filing</a>`:''}${p.ap?`<a href="${p.ap}" target="_blank" rel="noopener">Abridged prospectus</a>`:''}</div></article>`;
const more=[['Zetwerk Manufacturing Businesses','zetwerk-manufacturing-businesses-limited-rhp_105195','13 Oct'],['Tonbo Imaging India','tonbo-imaging-india-limited-rhp_105141','12 Oct'],['Sahajanand Medical Technologies','sahajanand-medical-technologies-limited-rhp_105149','10 Oct'],['Fusion CX','fusion-cx-limited-rhp_105257','9 Oct'],['HD Fire Protect','hd-fire-protect-limited-rhp_105058','5 Oct']];
function renderPipe(){$('#pipe').innerHTML=`<div class="src"><b>Where this list comes from (${esc(stamp)}).</b> SEBI’s red herring filings were read directly. NSE’s upcoming issues page builds its table with a script, so it came back empty. BSE’s page blocks automated access. Zerodha Varsity is for background reading and isn’t an IPO list. Press Update all data above to refresh it.${stamp.includes('snapshot')?'':' The last refresh used AI web search, so confirm key numbers on NSE or BSE.'}</div>`+
['open','wait','pipe'].map(g=>`<h3 class="gh">${GL[g][0]}</h3><p class="hint" style="color:var(--mu);font-size:.9rem;margin:0">${GL[g][1]}</p>`+P.map((p,n)=>[p,n]).filter(x=>x[0].g===g).map(x=>row(x[0],x[1])).join('')).join('')+
`<details><summary>Earlier October filings (already closed or closing)</summary><ul>${more.map(m=>`<li><a href="${S}${m[1]}.html" target="_blank" rel="noopener">${m[0]}</a>, RHP filed ${m[2]}</li>`).join('')}</ul></details>`}
function show(v){$('#pipe').hidden=v!=='pipe';$('#rpt').hidden=v!=='rpt';$('#mine').hidden=v!=='mine';document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('on',b.dataset.v===(v==='rpt'?'pipe':v)));window.scrollTo(0,0)}
async function copy(t,b){try{await navigator.clipboard.writeText(t)}catch(e){const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{document.execCommand('copy')}catch(_){}a.remove()}const o=b.textContent;b.textContent='Copied. Paste it in chat';setTimeout(()=>b.textContent=o,2400)}
document.addEventListener('click',e=>{const t=e.target.closest('.tab');if(t){show(t.dataset.v);return}
 const r=e.target.closest('.rs'),a=e.target.closest('.av');
 if(r){const p=P[+r.dataset.i];copy(`Deep research the ${p.name} IPO${p.open?' (bidding '+p.open+' to '+p.close+', price band '+p.band+')':''}. Use the SEBI RHP, NSE and BSE data, GMP, subscription, peers and financials. Give me the full report and a Good, Neutral or Bad verdict against my 25% gain and 15% loss bars.`,r)}
 if(a){const p=P[+a.dataset.i];let k=ipos.findIndex(x=>x.name.toLowerCase()===p.name.toLowerCase());if(k<0){ipos.push({name:p.name,price:p.price,list:p.list||'TBA',gmp:[],sub:{},fund:{},mood:null});k=ipos.length-1;save()}sel=k;show('mine');render()}});
// GMP report page. Chance labels are rule-based labels, not probabilities.
function chance(i,r){const p=r.mods[0].pct,s=i.sub&&i.sub.total!=null?i.sub.total:null;let reach,why;
 if(p>=25){reach=s!==null&&s>=10?'High':'Medium';why=s===null?'GMP clears 25%, but demand is unknown until bidding opens.':'GMP clears 25% and demand is strong.'}
 else if(p>=15){reach='Low to medium';why='GMP is between 15% and 25%.'}
 else if(p>=8){reach='Low';why='GMP is between 8% and 15%.'}
 else{reach='Very low';why='GMP is under 8%.'}
 let loss=p>=10?'Low':p>=0?'Moderate':'High';if(s!==null&&s<3)loss=loss==='Low'?'Moderate':'High';
 return{reach,loss,why}}
function renderRpt(i,p,n){const r=ev(i),g=r.mods[0],c=chance(i,r),lv=g.hist[g.hist.length-1].v,gap=i.price*.25-lv;
 const rows=[['GMP falls by half',.5],['GMP stays the same',1],['GMP rises by a quarter',1.25]].map(a=>{const v=lv*a[1],pc=v/i.price*100;return `<tr><td>${a[0]}</td><td>₹${v.toFixed(0)}</td><td>₹${(i.price+v).toFixed(0)}</td><td class="${pc>=25?'good':pc<0?'bad':'neu'}"><b>${pc.toFixed(1)}%</b></td></tr>`}).join('');
 const mh=r.mods.map(m=>{const w=m.scored?Math.min(100,Math.abs(m.points)/m.max*100):0;return `<div class="mod${m.scored?'':' off'}"><div><h4>${m.name}</h4><ul>${m.notes.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div><div class="sc">${m.scored?m.points+' of '+m.max:'Not scored'}</div><div class="bar${m.points<0?' neg':''}"><i style="width:${w}%"></i></div></div></div>`}).join('');
 $('#rpt').innerHTML=`<button class="btn bk">Back to pipeline</button>
 <section class="hero" style="margin-top:20px"><div><h2>${esc(i.name)}, GMP report as of ${esc(p.asof)}</h2><div class="vw ${g.pct>=25?'good':g.pct>=8?'neu':'no'}">${g.pct.toFixed(1)}%</div><p>GMP of ₹${lv} on an upper band of ₹${i.price}. The grey market points to a listing near ₹${i.price+lv}.</p></div></section>
 ${p.warn?`<div class="warn">${esc(p.warn)}</div>`:''}
 <div class="cc"><div><span>Chance of reaching your 25% bar</span><b>${c.reach}</b><span>${esc(c.why)}</span></div><div><span>Chance of a 15% loss</span><b>${c.loss}</b><span>${i.sub&&i.sub.total!=null?'Uses GMP and subscription.':'Uses GMP only.'}</span></div><div><span>Verdict</span><b class="${C[r.v]}">${L[r.v]}</b><span>Confidence ${r.conf}. ${r.n} of 4 checks have data.</span></div></div>
 <section class="sec" style="margin-top:0"><h3>Where the grey market points</h3><p class="hint">Gain you would see at listing if the GMP holds.</p>${ruler(g.pct)}
 <p>${gap<=0?`GMP is ₹${(-gap).toFixed(1)} above the ₹${(i.price*.25).toFixed(1)} needed for a 25% gain.`:`GMP needs to rise ₹${gap.toFixed(1)} more, to ₹${(i.price*.25).toFixed(1)}, to reach a 25% gain.`}</p></section>
 <section class="sec" style="margin-top:10px"><h3>If the grey market moves</h3><table class="sct"><tr><th>Scenario</th><th>GMP</th><th>Listing price</th><th>Gain</th></tr>${rows}</table><p class="hint">Plain arithmetic on today’s GMP. It is not a forecast.</p></section>
 <section class="sec" style="margin-top:10px"><h3>What the score is made of</h3>${mh}</section>
 ${p.facts?`<section class="sec" style="margin-top:10px"><h3>Company numbers used</h3><ul>${p.facts.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>`:''}
 <p class="foot">GMP sources: ${esc(p.srcs)}. GMP is unofficial and can change within hours, and the labels above come from fixed rules, not from a probability model. Confirm the price band and dates on NSE or BSE.</p>
 <div class="pa"><button class="btn bk">Back to pipeline</button><button class="btn p rs" data-i="${n}">Copy research request</button></div>`}
document.addEventListener('click',e=>{if(e.target.closest('.bk')){show('pipe');return}
 const c=e.target.closest('.ck');if(!c)return;const n=+c.dataset.i,p=P[n];
 let k=ipos.findIndex(x=>x.name.toLowerCase()===p.name.toLowerCase());
 if(k<0){ipos.push({name:p.name,price:p.price,list:p.list||'TBA',gmp:[],sub:{},fund:{},mood:null});k=ipos.length-1}
 const i=ipos[k],have=new Set(p.gmp.map(x=>x.d));i.price=p.price;i.gmp=[...p.gmp.map(x=>({...x})),...(i.gmp||[]).filter(x=>!have.has(x.d))];
 if(p.sub)i.sub=Object.assign({},i.sub,p.sub);if(p.fund)i.fund=Object.assign({},i.fund,p.fund);
 sel=k;save();render();renderRpt(i,p,n);show('rpt')});
// ---- Update all data: Gemini with Google Search ----
const PK='ipo-verdict-pipe-v1',AK='ipo-verdict-ai-v1';
let stamp='25 Oct 2026, built-in snapshot';
const ls={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
try{const s=JSON.parse(ls.get(PK));if(s&&Array.isArray(s.p)&&s.p.length){P=s.p;stamp=s.t}}catch(e){}
const cfg=()=>{try{return JSON.parse(ls.get(AK))||{}}catch(e){return{}}};
const nk=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const nn=x=>x==null||x===''||!isFinite(Number(x))?null:Number(x);
async function askAI(){const r=await fetch('/api/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({known:[...new Set([...P.map(p=>p.name),...ipos.filter(i=>!i.demo).map(i=>i.name)])]})});
 const j=await r.json().catch(()=>({}));
 if(!r.ok){const e=new Error(j.error||'HTTP '+r.status);e.status=j.status||r.status;throw e}
 return j}
function parseAI(t){const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a<0||b<a)throw new Error('parse');let j;try{j=JSON.parse(t.slice(a,b+1))}catch(e){throw new Error('parse')}if(!j||!Array.isArray(j.ipos))throw new Error('parse');return j.ipos}
function mergeAI(list){let upd=0,add=0;
 for(const r of list){if(!r||!r.name)continue;const k=nk(r.name);if(!k)continue;
  let p=P.find(x=>{const y=nk(x.name);return y===k||(k.length>4&&y.length>4&&(y.includes(k)||k.includes(y)))});
  if(p)upd++;else{p={name:String(r.name).slice(0,60),g:'pipe'};P.push(p);add++}
  if(['open','wait','pipe'].includes(r.group))p.g=r.group;
  ['state','open','close','band','lot','size','list','asof','srcs','note'].forEach(f=>{if(typeof r[f]==='string'&&r[f].trim())p[f]=r[f].trim().slice(0,200)});
  p.warn=typeof r.warn==='string'?r.warn.trim().slice(0,300):'';
  let pr=nn(r.price);if(!pr&&!p.price&&p.band){const m=String(p.band).match(/[\d,]+/g);if(m)pr=nn(m[m.length-1].replace(/,/g,''))}if(pr)p.price=pr;
  const g=(Array.isArray(r.gmp)?r.gmp:[]).map(x=>({d:String(x&&x.d||''),v:nn(x&&x.v)})).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.d)&&x.v!==null);
  if(g.length){const m=new Map((p.gmp||[]).map(x=>[x.d,x.v]));g.forEach(x=>m.set(x.d,x.v));p.gmp=[...m].map(([d,v])=>({d,v})).sort((a,b)=>a.d<b.d?-1:1).slice(-12)}
  [['sub',['total','qib','nii','retail']],['fund',['g','pe','de']]].forEach(([key,fl])=>{const o=r[key]||{};fl.forEach(f=>{const v=nn(o[f]);if(v!==null){p[key]=p[key]||{};p[key][f]=v}})});
  const i=ipos.find(x=>!x.demo&&nk(x.name)===nk(p.name));
  if(i&&p.price){i.price=p.price;if(p.list)i.list=p.list;if(p.gmp){const have=new Set(p.gmp.map(x=>x.d));i.gmp=[...p.gmp.map(x=>({...x})),...(i.gmp||[]).filter(x=>!have.has(x.d))]}
   if(p.sub)i.sub=Object.assign({},i.sub,p.sub);if(p.fund)i.fund=Object.assign({},i.fund,p.fund)}}
 return{upd,add}}
function explain(e){const m=String(e.message||'');
 if(m==='nokey')return'The server has no API key. Add GEMINI_API_KEY to the .env.local file and restart npm run dev.';
 if(e.status===429)return'Google says the free limit is used up, on every model I tried. Google said: '+m.slice(0,300);
 if(e.status===401||e.status===403||/api key/i.test(m))return'Google did not accept the key in .env.local. Check it and restart npm run dev.';
 if(m==='parse')return'The AI replied in a format I could not read. Press Update again.';
 if(m==='model')return'That AI model name was not found. Remove GEMINI_MODEL from .env.local to use the default.';
 if(e instanceof TypeError)return'Could not reach the server. Check that npm run dev is running.';
 return'Something went wrong: '+m}
$('#upall').onclick=async()=>{const b=$('#upall'),st=$('#ust'),er=$('#uerr');er.hidden=true;b.disabled=true;st.textContent='Step 1 of 3: asking the AI to search the web. This can take up to a minute.';
 try{const a=await askAI();st.textContent='Step 2 of 3: reading the answer.';const list=parseAI(a.txt);st.textContent='Step 3 of 3: updating your data.';
  const r=mergeAI(list);stamp=new Date().toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})+', AI web search';
  ls.set(PK,JSON.stringify({t:stamp,p:P}));save();renderPipe();render();
  st.textContent=`Updated ${stamp}. ${r.upd} refreshed, ${r.add} new, ${a.gs} web sources used.`}
 catch(e){st.textContent='Update failed.';er.textContent=explain(e);er.hidden=false}
 b.disabled=false};
renderPipe();
