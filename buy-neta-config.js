Object.defineProperty(window, 'NETA_SWAP_SIGNING', {
  value: Object.freeze({
    enabled: true,
    publicMaxUsd: 50,
    chainId: 'juno-1',
    pairs: Object.freeze([
      'juno17uv02azt545ag23xq7whw6z3r3chw7jwztnr9lypugy62drq3caqeyd2r3',
      'juno1gqy6rzary8vwnslmdavqre6jdhakcd4n2z4r803ajjmdq08r66hq7zcwrj',
      'juno1u2pl8ql778655wakqmnhpln65q9pughd6jnrp93xwf4zakqjdh6qx3y9yt',
      'juno18zk9xqj9xjm0ry39jjam8qsysj7qh49xwt4qdfp9lgtrk08sd58s2n54ve',
      'juno1h6x5jlvn6jhpnu63ufe4sgv4utyk8hsfl5rqnrpg2cvp6ccuq4lqwqnzra'
    ]),
    gasPrice: '0.075ujuno',
    gasAdjustment: 1.4,
    gasCap: 500000,
    memo: 'cosmoot:wynd-swap:v1',
    rpcEndpoints: Object.freeze([
      'https://juno.rpc.m.stavr.tech',
      'https://juno-rpc.polkachu.com:443',
      'https://juno-rpc.kleomedes.network',
      'https://rpc.lavenderfive.com:443/juno'
    ])
  }),
  writable: false,
  configurable: false
});
