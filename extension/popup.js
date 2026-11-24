const fmt=n=>Number(n).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
async function render(){
 const d=await chrome.storage.local.get({deals:[],lastScan:null});
 document.getElementById("status").textContent=d.lastScan?"Última varredura: "+new Date(d.lastScan).toLocaleString("pt-BR"):"Ainda não houve varredura.";
 const root=document.getElementById("deals");root.innerHTML="";
 for(const x of d.deals.slice(0,35)){
  const el=document.createElement("article");el.className="deal";
  const flag=x.suspicious?"⚠️ Possível bug":"🔥 Oportunidade";
  el.innerHTML=`<div class="flag">${flag}</div><h3></h3><strong>${fmt(x.price)}</strong><p></p><a target="_blank" rel="noreferrer">Abrir anúncio</a>`;
  el.querySelector("h3").textContent=x.title;el.querySelector("p").textContent=`${x.store} · ${x.reason}${x.discount!==null?" · "+x.discount+"% abaixo do menor observado":""}`;
  el.querySelector("a").href=x.url;root.appendChild(el);
 }
 if(!d.deals.length)root.textContent="Sem alertas por enquanto. Ajuste as palavras-chave nas configurações.";
}
document.getElementById("scan").onclick=()=>{chrome.runtime.sendMessage({type:"START_SCAN"});document.getElementById("status").textContent="Varredura iniciada…";};
render();chrome.storage.onChanged.addListener(render);