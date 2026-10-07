export function commitFixture(validators=[40,30,20,8,2].map((power,i)=>({address:String(i+1).repeat(40),voting_power:String(power)})),height=42452150,time=new Date().toISOString()){
 const hash=h=>h.toString(16).toUpperCase().padStart(64,'0');
 const set={result:{block_height:String(height),validators,count:String(validators.length),total:String(validators.length)}};
 const commits=Array.from({length:Math.min(5,height-42452000)},(_,i)=>({result:{canonical:true,signed_header:{header:{chain_id:'juno-1',height:String(height-i),time,validators_hash:'A'.repeat(64),last_block_id:{hash:hash(height-i-1)}},commit:{height:String(height-i),round:0,block_id:{hash:hash(height-i)},signatures:validators.map((v,index)=>index>=validators.length-2?{block_id_flag:1,validator_address:'',signature:null}:{block_id_flag:2,validator_address:v.address,signature:Buffer.alloc(64,index+1).toString('base64'),timestamp:time})}}}}));
 return {set,commits,height};
}
