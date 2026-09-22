(()=>{
  "use strict";
  // Set only after code review, deployment and verification of the on-chain config.
  const REGISTRY=null;
  const RESTS=["https://juno-api.polkachu.com","https://juno-api.lavenderfive.com"];
  const search=document.querySelector("#names-search"),result=document.querySelector("#names-result");
  function validName(value){return /^(?=.{5,32}\.neta$)[a-z0-9]+(?:-[a-z0-9]+)*\.neta$/.test(value)&&!["admin","neta","relay","support","treasury","governance"].includes(value.slice(0,-5))}
  function validAddress(value){return /^juno1[023456789acdefghjklmnpqrstuvwxyz]{38,90}$/.test(value)}
  async function query(message){if(!REGISTRY)throw new Error("The NETA Names registry is awaiting deployment.");const encoded=btoa(JSON.stringify(message));for(const base of RESTS){try{const response=await fetch(`${base}/cosmwasm/wasm/v1/contract/${REGISTRY}/smart/${encodeURIComponent(encoded)}`,{cache:"no-store"});if(response.ok){const body=await response.json();return body.data??body}}catch{}}throw new Error("The Juno registry could not be reached. Try again later.")}
  async function resolve(value){const normalized=value.trim().toLowerCase();if(validName(normalized))return query({resolve:{name:normalized}});if(validAddress(normalized))return query({name_of:{address:normalized}});throw new Error("Enter a valid .neta name or Juno address.")}
  window.NetaNames={resolve,validName,validAddress,active:!!REGISTRY};
  search?.addEventListener("submit",async event=>{event.preventDefault();const value=search.querySelector("input").value.trim();result.textContent="LOOKING UP ON JUNO…";try{const found=await resolve(value);if("expires_at" in found){result.textContent=found.address?`${found.name} → ${found.address} · expires ${new Date(found.expires_at*1000).toLocaleDateString()}`:found.in_grace?`${found.name} is expired and reserved for renewal.`:`${found.name} is available or unregistered.`}else result.textContent=found.name?`${found.address} → ${found.name}`:"No active .neta name is registered for this address."}catch(error){result.textContent=error.message}});
  const recipient=document.querySelector("#relay-recipient");
  if(recipient){const note=document.createElement("p");note.id="relay-recipient-resolution";note.className="names-resolution";note.setAttribute("role","status");recipient.after(note);let sequence=0;recipient.addEventListener("change",async()=>{const value=recipient.value.trim(),current=++sequence;note.textContent="";if(!value.endsWith(".neta"))return;try{const found=await resolve(value);if(current===sequence)note.textContent=found.address?`RESOLVES TO ${found.address} · verify this address before future sending`:"No active Juno address found for this name."}catch(error){if(current===sequence)note.textContent=error.message}})}
})();
