import globals from 'globals';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/target/**',
      '.ci-tools/**',
      'dist/**',
      'assets/**',
      'docs/**',
      'relay-personal-pilot.js'
    ]
  },
  {
    // Runtime modules must not rely on undeclared names. Browser test callbacks
    // serialized into another realm have their own fixture globals; the existing
    // correctness rules below still apply to those files.
    files: ['**/*.{js,mjs}'],
    ignores: ['tests/**', '**/test/**', '**/tests/**', 'spikes/**'],
    rules: { 'no-undef': 'error' }
  },
  {
    files: [
      '*.{js,mjs}',
      'src/**/*.{js,mjs}',
      'community-tools/**/*.{js,mjs}',
      'faucet/src/*.{js,mjs}',
      'names/mainnet-deploy.mjs',
      'names/mainnet-setup.mjs'
    ],
    languageOptions: { globals: globals.browser }
  },
  {
    files: [
      'scripts/**/*.{js,mjs}',
      'service/*.mjs',
      'faucet/service/*.mjs',
      'relay-backup/**/*.mjs',
      'discussions/*.mjs',
      'names/**/*.mjs'
    ],
    ignores: ['names/mainnet-deploy.mjs', 'names/mainnet-setup.mjs'],
    languageOptions: { globals: globals.nodeBuiltin }
  },
  {
    files: ['functions/**/*.js', 'deploy/cosmoot/governance-read-proxy.mjs'],
    languageOptions: { globals: globals.serviceworker }
  },
  {
    // These entry points deliberately access globals installed by reviewed,
    // on-demand signing bundles. Keep this exception local to their consumers.
    files: ['juno-proposal-funding.mjs', 'native-voting-ui.mjs', 'planner-native-governance.mjs'],
    languageOptions: { globals: { NetaJunoGovernance: 'readonly' } }
  },
  {
    files: ['names.js', 'neta-governance.js', 'relay-testnet-setup.js'],
    languageOptions: { globals: { NetaSocialsTestnet: 'readonly' } }
  },
  {
    files: ['neta-governance.js'],
    languageOptions: { globals: { NetaNamesSigning: 'readonly' } }
  },
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      'constructor-super': 'error',
      'for-direction': 'error',
      'getter-return': 'error',
      'no-async-promise-executor': 'error',
      'no-class-assign': 'error',
      'no-compare-neg-zero': 'error',
      'no-const-assign': 'error',
      'no-dupe-args': 'error',
      'no-dupe-class-members': 'error',
      'no-dupe-else-if': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-ex-assign': 'error',
      'no-func-assign': 'error',
      'no-import-assign': 'error',
      'no-invalid-regexp': 'error',
      'no-loss-of-precision': 'error',
      'no-new-native-nonconstructor': 'error',
      'no-obj-calls': 'error',
      'no-unreachable': 'error',
      'no-unsafe-finally': 'error',
      'no-unsafe-negation': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error'
    }
  },
  {
    files: ['src/governance/*.mjs'],
    rules: {
      'no-shadow': 'error',
      'no-use-before-define': ['error', { functions: false }]
    }
  }
];
