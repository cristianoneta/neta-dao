// Adapted from neta-website 7ad0bbf: direct WYND swap, current Cosmoot shell.
(()=>{
  "use strict";
  const PAIR="juno1h6x5jlvn6jhpnu63ufe4sgv4utyk8hsfl5rqnrpg2cvp6ccuq4lqwqnzra";
  const NETA="juno168ctmpyppk90d34p3jjy658zf5a5l3w8wk35wht6ccqj4mr0yv8s4j5awr";
  const PAIR_CODE_ID="2289";
  const LCD_ENDPOINTS=["https://juno.api.m.stavr.tech","https://juno-api.polkachu.com","https://juno-rest.publicnode.com"];
  const LIMIT_USD=25;
  const DECIMALS=6;
  const QUOTE_REFRESH_MS=12000;
  const SIGNING=window.NETA_SWAP_SIGNING;
  const assets={
    JUNO:{symbol:"JUNO",logo:"/assets/juno-chain.png",info:{native:"ujuno"}},
    NETA:{symbol:"NETA",logo:"/assets/neta-token.png",info:{token:NETA}},
  };
  const dom={
    amount:document.querySelector("#offer-amount"),receive:document.querySelector("#receive-amount"),
    offerSymbol:document.querySelector("#offer-symbol"),receiveSymbol:document.querySelector("#receive-symbol"),
    offerLogo:document.querySelector("#offer-logo"),receiveLogo:document.querySelector("#receive-logo"),
    offerUsd:document.querySelector("#offer-usd"),receiveUsd:document.querySelector("#receive-usd"),
    offerBalance:document.querySelector("#offer-balance"),max:document.querySelector("#max-button"),
    reverse:document.querySelector("#reverse-swap"),message:document.querySelector("#quote-error"),
    age:document.querySelector("#quote-age"),rate:document.querySelector("#quote-rate"),
    impact:document.querySelector("#price-impact"),fee:document.querySelector("#pool-fee"),
    minimum:document.querySelector("#minimum-received"),slippageSummary:document.querySelector("#slippage-summary"),slippageSummaryButton:document.querySelector("#slippage-summary-button"),
    contractState:document.querySelector("#contract-state"),source:document.querySelector("#quote-source"),
    settings:document.querySelector("#slippage-settings"),settingsToggle:document.querySelector("#settings-toggle"),
    custom:document.querySelector("#custom-slippage"),slippageButtons:[...document.querySelectorAll("[data-slippage]")],
    action:document.querySelector("#swap-action"),modal:document.querySelector("#swap-modal"),
    modalState:document.querySelector("#swap-modal-state"),preview:document.querySelector("#swap-preview"),
    modalMessage:document.querySelector("#swap-modal-message"),confirm:document.querySelector("#confirm-swap"),
    close:document.querySelector("#close-swap"),result:document.querySelector("#swap-result"),
    resultLabel:document.querySelector("#swap-result-label"),resultHash:document.querySelector("#swap-result-hash"),explorer:document.querySelector("#swap-explorer"),
  };
  if(!dom.amount||!window.NetaCosmosClient)return;
  const client=new window.NetaCosmosClient(LCD_ENDPOINTS);
  let offer="JUNO",slippage=5,junoUsd=null,pool=null,contractValid=false;
  let quote=null,requestId=0,debounceTimer=null,refreshTimer=null,ageTimer=null,balanceRaw=null;
  let signing=false,previewIntent=null,balanceRequest=0,marketRevision=0;

  const other=symbol=>symbol==="JUNO"?"NETA":"JUNO";
  const asNumber=raw=>Number(raw)/10**DECIMALS;
  const money=value=>Number.isFinite(value)?`≈ $${value.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`:"≈ —";
  const amountText=(raw,max=6)=>asNumber(raw).toLocaleString("en-US",{useGrouping:false,maximumFractionDigits:max});
  const queryInfo=asset=>{const info=asset.info||asset;return info.native?`native:${info.native}`:`token:${info.token}`};
  const expectedAssets=new Set(["native:ujuno",`token:${NETA}`]);
  const signingConfigValid=Boolean(SIGNING&&SIGNING.chainId==="juno-1"&&SIGNING.pair===PAIR&&SIGNING.neta===NETA&&SIGNING.pairCodeId===PAIR_CODE_ID&&SIGNING.publicMaxUsd===LIMIT_USD);

  function parseAmount(value){
    const clean=value.trim().replace(",",".");
    if(!/^(?:\d+)(?:\.\d{0,6})?$/.test(clean))throw new Error("ENTER A VALID AMOUNT WITH UP TO 6 DECIMALS");
    const [whole,fraction=""]=clean.split(".");
    const raw=BigInt(whole)*1000000n+BigInt((fraction+"000000").slice(0,6));
    if(raw<=0n)throw new Error("Enter an amount GREATER THAN ZERO");
    return raw;
  }

  function tokenUsd(symbol){
    if(!junoUsd||!pool)return null;
    if(symbol==="JUNO")return junoUsd;
    const junoReserve=pool.assets.find(asset=>asset.info.native==="ujuno");
    const netaReserve=pool.assets.find(asset=>asset.info.token===NETA);
    if(!junoReserve||!netaReserve||Number(netaReserve.amount)<=0)return null;
    return Number(junoReserve.amount)/Number(netaReserve.amount)*junoUsd;
  }

  function setMessage(text,state=""){
    dom.message.textContent=text;
    if(state)dom.message.dataset.state=state;else delete dom.message.dataset.state;
  }

  function clearQuote(message="Enter an amount to get a quote",state=""){
    quote=null;dom.receive.textContent="0.0";dom.receiveUsd.textContent="≈ $0.00";dom.age.textContent="Enter an amount";
    dom.rate.textContent="—";dom.impact.textContent="—";delete dom.impact.dataset.alert;dom.fee.textContent="0.30%";dom.minimum.textContent="—";
    setMessage(message,state);
    renderAction();
  }

  function renderDirection(){
    const receive=other(offer);
    dom.offerSymbol.textContent=offer;dom.receiveSymbol.textContent=receive;
    dom.offerLogo.src=assets[offer].logo;dom.receiveLogo.src=assets[receive].logo;
    dom.offerUsd.textContent="≈ $0.00";dom.receiveUsd.textContent="≈ $0.00";
    updateBalance();
    renderAction();
  }

  function signingAuthority(){
    const address=window.NETA_WALLET_STATE?.address;
    if(!SIGNING?.enabled||!signingConfigValid)return{ok:false,label:"SWAP SIGNING IS DISABLED"};
    if(!address)return{ok:false,label:"Connect Keplr first"};
    if(!contractValid)return{ok:false,label:"Pool verification required"};
    if(!quote)return{ok:false,label:"Enter an amount"};
    if(balanceRaw===null)return{ok:false,label:"Balance unavailable"};
    if(quote.raw>balanceRaw)return{ok:false,label:`INSUFFICIENT ${offer} BALANCE`};
    return{ok:true,label:"Review swap"};
  }

  function renderAction(){
    if(!dom.action)return;
    const authority=signingAuthority();dom.action.disabled=!authority.ok||signing;dom.action.textContent=authority.label;
  }

  async function loadMarket(){
    const response=await fetch("/data/treasury/juno-delegation.json",{cache:"no-store"});
    if(!response.ok)throw new Error("USD price snapshot unavailable");
    const market=await response.json();
    const juno=market.assets?.find(asset=>asset.key==="juno:native:ujuno"&&asset.source_chain==="juno"&&asset.decimals===6);
    const stamp=Date.parse(market.generated_at||"");
    if(market.chain_id!=="juno-1"||market.dao_id!=="juno-delegation"||!["LIVE","PARTIAL"].includes(market.status)||!Number.isFinite(Number(juno?.usd_price))||Number(juno.usd_price)<=0||!Number.isFinite(stamp)||stamp>Date.now()+60000)throw new Error("Invalid USD price snapshot");
    if(Date.now()-stamp>36*60*60*1000)throw new Error("USD price snapshot is stale");
    return Number(juno.usd_price);
  }

  async function validateContract(){
    const [info,pairInfo,livePool]=await Promise.all([
      client.contractInfo(PAIR),client.smart(PAIR,{pair:{}}),client.smart(PAIR,{pool:{}}),
    ]);
    if(String(info.code_id)!==PAIR_CODE_ID)throw new Error("PAIR CODE ID DOES NOT MATCH THE ALLOWLIST");
    if(pairInfo.contract_addr!==PAIR)throw new Error("PAIR IDENTITY DOES NOT MATCH");
    const listed=new Set((pairInfo.asset_infos||[]).map(queryInfo));
    if(listed.size!==2||[...expectedAssets].some(key=>!listed.has(key)))throw new Error("PAIR ASSETS DO NOT MATCH JUNO / NETA");
    if(String(pairInfo.fee_config?.total_fee_bps)!=="30")throw new Error("PAIR FEE DOES NOT MATCH 0.30%");
    return {pool:livePool,source:client.preferredEndpoint};
  }

  async function loadVerifiedMarket(){
    const revision=++marketRevision;
    contractValid=false;junoUsd=null;pool=null;requestId++;
    clearQuote("Checking the pool…","loading");
    dom.contractState.textContent="Checking";dom.contractState.dataset.ok="false";
    try{
      // Neither independent read can publish a partial success or revive a failed check.
      const [price,verified]=await Promise.all([loadMarket(),validateContract()]);
      if(revision!==marketRevision)throw new Error("Pool check superseded. Refresh again.");
      junoUsd=price;pool=verified.pool;contractValid=true;
      dom.contractState.textContent="Verified";dom.contractState.dataset.ok="true";
      dom.source.textContent=verified.source?.replace("https://","").toUpperCase()||"JUNO LCD";
    }catch(error){
      if(revision===marketRevision){
        contractValid=false;junoUsd=null;pool=null;
        dom.contractState.textContent="Unavailable";dom.contractState.dataset.ok="false";
      }
      throw error;
    }
  }

  function quoteUsd(raw,symbol){const price=tokenUsd(symbol);return price===null?null:asNumber(raw)*price}

  async function requestQuote(){
    clearTimeout(debounceTimer);clearTimeout(refreshTimer);
    const id=++requestId;
    let raw;
    try{raw=parseAmount(dom.amount.value)}catch(error){
      dom.offerUsd.textContent="≈ $0.00";
      clearQuote(dom.amount.value?error.message:"Enter an amount to get a quote",dom.amount.value?"error":"");return;
    }
    if(!contractValid){clearQuote("Checking the pool…","loading");return}
    const usd=quoteUsd(raw,offer);dom.offerUsd.textContent=money(usd);
    if(usd===null){clearQuote("USD LIMIT CANNOT BE VERIFIED — QUOTE BLOCKED","error");return}
    if(usd>LIMIT_USD+0.000001){clearQuote(`$25 LIMIT EXCEEDED — CURRENT ESTIMATE ${money(usd).replace("EST. ","")}`,"error");return}
    setMessage("Getting a live quote…","loading");
    try{
      const response=await client.smart(PAIR,{simulation:{offer_asset:{info:assets[offer].info,amount:String(raw)},ask_asset_info:null,referral:false,referral_commission:null}});
      if(id!==requestId)return;
      const returned=BigInt(response.return_amount),fee=BigInt(response.commission_amount),spread=BigInt(response.spread_amount);
      if(returned<=0n)throw new Error("CONTRACT RETURNED AN EMPTY QUOTE");
      const noImpact=returned+fee+spread;
      const impact=noImpact?Number(spread)*100/Number(noImpact):0;
      const min=returned*BigInt(Math.round((100-slippage)*100))/10000n;
      quote={raw,returned,fee,spread,min,at:Date.now(),offer,receive:other(offer),usd};
      dom.receive.textContent=amountText(returned);dom.receiveUsd.textContent=money(quoteUsd(returned,quote.receive));
      dom.rate.textContent=`1 ${offer} ≈ ${(asNumber(returned)/asNumber(raw)).toLocaleString("en-US",{maximumFractionDigits:8})} ${quote.receive}`;
      dom.impact.textContent=`${impact.toFixed(2)}%`;dom.impact.dataset.alert=String(impact>=2);
      dom.fee.textContent=`0.30% · ${amountText(fee)} ${quote.receive}`;
      dom.minimum.textContent=`${amountText(min)} ${quote.receive}`;
      setMessage("Quote ready to review","ok");
      renderAction();
      renderAge();refreshTimer=setTimeout(requestQuote,QUOTE_REFRESH_MS);
    }catch(error){if(id===requestId)clearQuote(`QUOTE FAILED: ${(error.message||String(error)).toUpperCase()}`,"error")}
  }

  function scheduleQuote(){requestId++;clearQuote("Refreshing quote…","loading");clearTimeout(debounceTimer);clearTimeout(refreshTimer);debounceTimer=setTimeout(requestQuote,320)}
  function renderAge(){if(!quote)return;const seconds=Math.max(0,Math.floor((Date.now()-quote.at)/1000));dom.age.textContent=seconds?`Updated ${seconds}s ago`:"Just updated"}

  async function updateBalance(){
    const address=window.NETA_WALLET_STATE?.address,token=offer,id=++balanceRequest;
    balanceRaw=null;dom.max.disabled=true;
    renderAction();
    if(!address){dom.offerBalance.textContent="Balance —";return}
    dom.offerBalance.textContent="Loading balance…";
    try{
      let next;
      if(token==="JUNO"){
        const {data}=await client.get(`/cosmos/bank/v1beta1/balances/${address}/by_denom?denom=ujuno`);
        next=BigInt(data.balance?.amount||"0");
      }else{
        const result=await client.smart(NETA,{balance:{address}});next=BigInt(result.balance||"0");
      }
      if(id!==balanceRequest||address!==window.NETA_WALLET_STATE?.address||token!==offer)return;
      balanceRaw=next;dom.offerBalance.textContent=`Balance ${amountText(balanceRaw)} ${offer}`;dom.max.disabled=balanceRaw<=0n;
    }catch{if(id===balanceRequest)dom.offerBalance.textContent="Balance unavailable"}finally{if(id===balanceRequest)renderAction()}
  }

  function beliefPrice(raw,returned){
    const scale=10n**18n,value=raw*scale/returned,whole=value/scale,fraction=String(value%scale).padStart(18,"0").replace(/0+$/,"");
    return fraction?`${whole}.${fraction}`:String(whole);
  }

  function buildTransaction(liveQuote,address){
    const maxSpread=(slippage/100).toFixed(4).replace(/0+$/,"").replace(/\.$/,"");
    const belief=beliefPrice(liveQuote.raw,liveQuote.returned);
    if(liveQuote.offer==="JUNO")return{
      contract:PAIR,
      message:{swap:{offer_asset:{info:{native:"ujuno"},amount:String(liveQuote.raw)},ask_asset_info:{token:NETA},belief_price:belief,max_spread:maxSpread,to:address,referral_address:null,referral_commission:null}},
      funds:[{denom:"ujuno",amount:String(liveQuote.raw)}],
    };
    const hook={swap:{ask_asset_info:{native:"ujuno"},belief_price:belief,max_spread:maxSpread,to:address,referral_address:null,referral_commission:null}};
    return{contract:NETA,message:{send:{contract:PAIR,amount:String(liveQuote.raw),msg:btoa(JSON.stringify(hook))}},funds:[]};
  }

  async function assetBalance(symbol,address){
    if(symbol==="JUNO"){
      const {data}=await client.get(`/cosmos/bank/v1beta1/balances/${address}/by_denom?denom=ujuno`);return BigInt(data.balance?.amount||"0");
    }
    const result=await client.smart(NETA,{balance:{address}});return BigInt(result.balance||"0");
  }

  async function freshQuoteForSigning(){
    const address=window.NETA_WALLET_STATE?.address;
    if(!address||!SIGNING?.enabled||!signingConfigValid)throw new Error("SWAP SIGNING IS NOT AVAILABLE");
    await loadVerifiedMarket();
    const raw=parseAmount(dom.amount.value),usd=quoteUsd(raw,offer),cap=SIGNING.publicMaxUsd;
    if(usd===null||usd>cap+0.000001)throw new Error(`SWAP EXCEEDS THE $${cap} SIGNING LIMIT`);
    const available=await assetBalance(offer,address);if(raw>available)throw new Error(`INSUFFICIENT ${offer} BALANCE`);
    const response=await client.smart(PAIR,{simulation:{offer_asset:{info:assets[offer].info,amount:String(raw)},ask_asset_info:null,referral:false,referral_commission:null}});
    const returned=BigInt(response.return_amount),fee=BigInt(response.commission_amount),spread=BigInt(response.spread_amount);
    if(returned<=0n)throw new Error("FRESH QUOTE IS EMPTY");
    return{raw,returned,fee,spread,min:returned*BigInt(Math.round((100-slippage)*100))/10000n,offer,receive:other(offer),usd};
  }

  function transactionPreview(liveQuote,tx,address,gasWanted=null){
    return{network:SIGNING.chainId,sender:address,direction:`${liveQuote.offer} -> ${liveQuote.receive}`,estimated_usd:liveQuote.usd.toFixed(4),per_swap_limit_usd:SIGNING.publicMaxUsd,max_slippage:`${slippage.toFixed(2)}%`,minimum_received:`${amountText(liveQuote.min)} ${liveQuote.receive}`,memo:SIGNING.memo,contract:tx.contract,message:tx.message,funds:tx.funds,gas_wanted:gasWanted,signing_enabled:true};
  }

  function renderPreview(liveQuote,tx,address,gas=null){
    dom.preview.textContent=JSON.stringify(transactionPreview(liveQuote,tx,address,gas),null,2);
    document.querySelector('#review-pay').textContent=amountText(liveQuote.raw)+' '+liveQuote.offer;
    document.querySelector('#review-receive').textContent=amountText(liveQuote.returned)+' '+liveQuote.receive;
    document.querySelector('#review-minimum').textContent=amountText(liveQuote.min)+' '+liveQuote.receive;
    document.querySelector('#review-wallet').textContent=address;
    document.querySelector('#review-fee').textContent=gas ? amountText(BigInt(window.NetaSwapSigning.fixedFee(gas,SIGNING.gasAdjustment,SIGNING.gasPrice,SIGNING.gasCap).amount[0].amount))+' JUNO' : 'Calculated before signing';
  }
  function closePreview(){if(signing)return;dom.modal.close();dom.action.focus();}
  dom.modal.addEventListener('cancel',event=>{event.preventDefault();closePreview();});

  function openPreview(){
    if(!signingAuthority().ok)return;
    const address=window.NETA_WALLET_STATE.address,tx=buildTransaction(quote,address);
    previewIntent={address,raw:quote.raw,offer:quote.offer,slippage,min:quote.min};
    renderPreview(quote,tx,address);
    dom.modalState.textContent="Review your swap";delete dom.modalState.dataset.state;
    dom.modalMessage.textContent="Your quote, balance and $25 limit are checked again before Keplr opens. A network fee in JUNO applies.";
    dom.result.hidden=true;dom.confirm.hidden=false;dom.confirm.disabled=false;dom.modal.showModal();dom.confirm.focus();
  }

  function errorText(error){
    const raw=error instanceof Error?error.message:String(error||"UNKNOWN ERROR");
    return raw.replace(/\s+/g," ").trim().toUpperCase()||"UNKNOWN ERROR";
  }

  function receivedFromEvents(events,symbol,address){
    for(const event of events||[]){
      const attrs=Object.fromEntries((event.attributes||[]).map(item=>[item.key,item.value]));
      if(symbol==="NETA"&&event.type==="wasm"&&attrs._contract_address===NETA&&attrs.action==="transfer"&&attrs.to===address&&/^\d+$/.test(attrs.amount||""))return BigInt(attrs.amount);
      if(symbol==="JUNO"&&event.type==="transfer"&&(event.attributes||[]).some(item=>item.key==="recipient"&&item.value===address)){
        for(const item of event.attributes||[]){
          if(item.key!=="amount")continue;
          const match=String(item.value).match(/(?:^|,)(\d+)ujuno(?:,|$)/);if(match)return BigInt(match[1]);
        }
      }
    }
    return 0n;
  }

  async function signSwap(){
    if(signing||!previewIntent)return;const reviewed=previewIntent;signing=true;const controls=[dom.amount,dom.reverse,dom.max,dom.custom,...dom.slippageButtons];controls.forEach(item=>item.disabled=true);renderAction();dom.confirm.disabled=true;dom.close.disabled=true;
    dom.modalState.dataset.state="loading";dom.modalState.textContent="Refreshing quote and checking your balance…";dom.result.hidden=true;
    let signingClient,broadcastHash="";
    try{
      const address=window.NETA_WALLET_STATE?.address,liveQuote=await freshQuoteForSigning();
      if(address!==reviewed.address||liveQuote.raw!==reviewed.raw||liveQuote.offer!==reviewed.offer||slippage!==reviewed.slippage)throw new Error("SWAP PARAMETERS CHANGED — REVIEW AGAIN");
      if(liveQuote.min<reviewed.min)throw new Error("Quote moved below your reviewed minimum. Close and review a new quote.");
      const tx=buildTransaction(liveQuote,address);
      dom.modalState.textContent="Preparing transaction…";
      const walletSigner=window.NETA_WALLET_STATE?.signer;if(!walletSigner||(await walletSigner.getAccounts())[0]?.address!==address)throw new Error("KEPLR ACCOUNT CHANGED — REVIEW AGAIN");
      const connection=await window.NetaSwapSigning.connect(SIGNING.rpcEndpoints,walletSigner,SIGNING.gasPrice);
      signingClient=connection.client;
      if(await signingClient.getChainId()!==SIGNING.chainId)throw new Error("Signing RPC is on the wrong network");
      const gas=await window.NetaSwapSigning.simulate(signingClient,address,tx.contract,tx.message,tx.funds,SIGNING.memo);
      if(!Number.isSafeInteger(gas)||gas<=0||gas>SIGNING.gasCap)throw new Error(`SIMULATED GAS ${gas} EXCEEDS SAFETY CAP ${SIGNING.gasCap}`);
      renderPreview(liveQuote,tx,address,gas);
      if(window.NETA_WALLET_STATE?.address!==address||(await walletSigner.getAccounts())[0]?.address!==address)throw new Error("KEPLR ACCOUNT CHANGED — REVIEW AGAIN");
      dom.modalState.textContent="Confirm the transaction in Keplr";
      const result=await window.NetaSwapSigning.execute(signingClient,address,tx.contract,tx.message,tx.funds,window.NetaSwapSigning.fixedFee(gas,SIGNING.gasAdjustment,SIGNING.gasPrice,SIGNING.gasCap),SIGNING.memo,{assertWallet:async()=>{if(window.NETA_WALLET_STATE?.address!==address||(await walletSigner.getAccounts())[0]?.address!==address)throw new Error("Keplr account changed. Review again.");}});
      broadcastHash=String(result?.transactionHash||"").toUpperCase();if(!/^[0-9A-F]{64}$/.test(broadcastHash))throw new Error("BROADCAST RETURNED NO VALID TRANSACTION HASH");
      dom.resultLabel.textContent="Transaction included";dom.resultHash.textContent=broadcastHash;dom.explorer.href=`https://atomscan.com/juno/transactions/${broadcastHash}`;dom.result.hidden=false;dom.confirm.hidden=true;
      dom.modalState.textContent="Transaction included. Checking the received asset…";
      const received=receivedFromEvents(result.events,liveQuote.receive,address);
      if(received<liveQuote.min)throw new Error(`TRANSACTION WAS INCLUDED BUT THE RECEIVED ${liveQuote.receive} EVENT COULD NOT BE VERIFIED`);
      dom.modalState.dataset.state="ok";dom.modalState.textContent=`Transaction confirmed · RECEIVED ${amountText(received)} ${liveQuote.receive}`;
      dom.resultLabel.textContent="Transaction confirmed";
      dom.modalMessage.textContent="The transaction was included on Juno and its receiving-asset event satisfies the displayed minimum.";
      await updateBalance();scheduleQuote();
    }catch(error){
      dom.modalState.dataset.state="error";dom.modalState.textContent=broadcastHash?"Transaction included · verification incomplete":"Transaction not confirmed";dom.modalMessage.textContent=errorText(error);
      if(broadcastHash){dom.resultLabel.textContent="Transaction included";dom.resultHash.textContent=broadcastHash;dom.explorer.href=`https://atomscan.com/juno/transactions/${broadcastHash}`;dom.result.hidden=false;dom.confirm.hidden=true}
    }
    finally{try{signingClient?.disconnect()}catch{}signing=false;controls.forEach(item=>item.disabled=false);dom.max.disabled=balanceRaw===null||balanceRaw<=0n;dom.close.disabled=false;if(!dom.confirm.hidden)dom.confirm.disabled=false;renderAction()}
  }

  function selectSlippage(value){
    if(!Number.isFinite(value)||value<0.1||value>10){setMessage("SLIPPAGE MUST BE BETWEEN 0.1% AND 10%","error");return false}
    if(value===slippage)return true;
    slippage=value;dom.slippageSummary.textContent=`${slippage.toFixed(2)}%`;
    dom.slippageButtons.forEach(button=>button.classList.toggle("selected",Number(button.dataset.slippage)===value));
    if(quote)scheduleQuote();return true;
  }

  function toggleSlippageSettings(forceOpen){
    const open=forceOpen===undefined?dom.settings.hidden:Boolean(forceOpen);
    dom.settings.hidden=!open;dom.settingsToggle.setAttribute("aria-expanded",String(open));
    if(open&&forceOpen)dom.custom.focus();
  }

  dom.amount.addEventListener("input",scheduleQuote);
  dom.reverse.addEventListener("click",()=>{
    const previous=quote?.returned;offer=other(offer);renderDirection();
    dom.amount.value=previous?amountText(previous):dom.amount.value;clearQuote();scheduleQuote();
  });
  dom.max.addEventListener("click",()=>{
    if(balanceRaw===null)return;const price=tokenUsd(offer);if(!price)return;
    const limitRaw=BigInt(Math.floor(LIMIT_USD/price*1e6));const spendable=offer==="JUNO"?(balanceRaw>60000n?balanceRaw-60000n:0n):balanceRaw;const chosen=spendable<limitRaw?spendable:limitRaw;
    dom.amount.value=amountText(chosen);scheduleQuote();
  });
  dom.settingsToggle.addEventListener("click",()=>toggleSlippageSettings());
  dom.slippageSummaryButton?.addEventListener("click",()=>toggleSlippageSettings(true));
  dom.slippageButtons.forEach(button=>button.addEventListener("click",()=>{dom.custom.value="";selectSlippage(Number(button.dataset.slippage))}));
  dom.custom.addEventListener("input",()=>{
    const value=Number(dom.custom.value.replace(",","."));
    if(dom.custom.value&&Number.isFinite(value)&&value>=0.1&&value<=10)selectSlippage(value);
  });
  dom.custom.addEventListener("change",()=>selectSlippage(Number(dom.custom.value.replace(",","."))));
  addEventListener("neta:wallet-connected",updateBalance);addEventListener("neta:wallet-disconnected",()=>{updateBalance();if(!signing)closePreview()});
  dom.action?.addEventListener("click",openPreview);dom.confirm?.addEventListener("click",signSwap);
  dom.close?.addEventListener("click",()=>{if(!signing)closePreview()});
  ageTimer=setInterval(renderAge,1000);addEventListener("pagehide",()=>{clearInterval(ageTimer);clearTimeout(refreshTimer)});

  renderDirection();
  function refreshPool(){return loadVerifiedMarket().then(()=>{
    setMessage("Pool verified. Enter an amount to get a quote.","ok");if(dom.amount.value)scheduleQuote();
  }).catch(error=>{
    clearQuote(`SAFETY CHECK FAILED: ${(error.message||String(error)).toUpperCase()}`,"error");
  });}
  document.querySelector("#refresh-pool").addEventListener("click",refreshPool);
  refreshPool();
})();
