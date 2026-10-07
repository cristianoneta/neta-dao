const destination=document.body.dataset.destination;
if(/^\/community-tools\/(?:juno-faucet\/|validator-upgrades\/juno-v31\/)$/.test(destination||''))location.replace(destination+location.search+location.hash);
