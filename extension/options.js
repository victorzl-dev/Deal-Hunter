const defaults={keywords:["PlayStation 5","notebook gamer","SSD 1TB","memória RAM DDR4","monitor 144Hz","smartphone"],intervalMinutes:15,enabledStores:["amazon","ml","magalu","kabum","carrefour","casasbahia","pichau","terabyte"],discordWebhook:""};
(async()=>{
 const d=await chrome.storage.local.get({settings:defaults}),v={...defaults,...d.settings};
 document.getElementById("keywords").value=v.keywords.join("\n");document.getElementById("interval").value=String(v.intervalMinutes);document.getElementById("webhook").value=v.discordWebhook||"";
 const root=document.getElementById("stores");
 STORES.forEach(st=>{const l=document.createElement("label");l.className="check";const c=document.createElement("input");c.type="checkbox";c.value=st.id;c.checked=v.enabledStores.includes(st.id);l.append(c,document.createTextNode(st.name));root.append(l);});
})();
document.getElementById("save").onclick=async()=>{
 const settings={keywords:document.getElementById("keywords").value.split("\n").map(x=>x.trim()).filter(Boolean).slice(0,12),intervalMinutes:Number(document.getElementById("interval").value),discordWebhook:document.getElementById("webhook").value.trim(),enabledStores:[...document.querySelectorAll("#stores input:checked")].map(x=>x.value),enabled:true,aggressive:true,bugHunter:true};
 await chrome.storage.local.set({settings});chrome.runtime.sendMessage({type:"SAVE_SETTINGS",settings});document.getElementById("saved").textContent="Configurações salvas.";
};