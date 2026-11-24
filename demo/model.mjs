export const STORAGE_KEY = 'cosmoot.gno.demo.v1';
export const OWN_ID = 'wallet-demo-you';
export const examplePeople = [
  {
    id: 'wallet-demo-anika',
    name: 'anika',
    role: 'Builder',
    bio: 'Building useful things, one small release at a time. Working on the first Cosmoot builder sprint.',
    initials: 'AN',
    telegram: 'anika_builds',
    discord: 'anika.builds',
    proposals: 3,
    comments: 12
  },
  {
    id: 'wallet-demo-jules',
    name: 'jules',
    role: 'Steward',
    bio: 'Helping good proposals become clear decisions. Treasury, coordination and community operations.',
    initials: 'JU',
    telegram: 'jules_gno',
    discord: 'jules.gno',
    proposals: 2,
    comments: 18
  },
  {
    id: 'wallet-demo-noor',
    name: 'noor',
    role: 'Designer',
    bio: 'Making on-chain communities easier to participate in. Product design and accessible interfaces.',
    initials: 'NO',
    telegram: '',
    discord: 'noor.design',
    proposals: 1,
    comments: 8
  },
  {
    id: 'wallet-demo-ember',
    name: 'ember',
    role: 'Developer',
    bio: 'Gno realms, documentation and developer experience. Here to help other builders get started.',
    initials: 'EM',
    telegram: 'ember_dev',
    discord: 'ember.dev',
    proposals: 1,
    comments: 7
  },
  {
    id: 'wallet-demo-leo',
    name: 'leo',
    role: 'Contributor',
    bio: 'Connecting people across communities. Events, onboarding and useful conversations.',
    initials: 'LE',
    telegram: 'leo_community',
    discord: '',
    proposals: 0,
    comments: 6
  },
  {
    id: 'wallet-demo-river',
    name: 'river',
    role: 'Member',
    bio: 'Reading proposals, asking questions and learning by contributing.',
    initials: 'RI',
    telegram: '',
    discord: 'river.gno',
    proposals: 0,
    comments: 4
  }
];
export const proposalFixtures = [
  {
    id: 12,
    title: 'Fund the first builder sprint',
    status: 'Discussion',
    topic: 'Development',
    amount: 12000,
    author: 'wallet-demo-anika',
    duration: '4 weeks',
    revision: 3,
    summary: 'A focused, four-week sprint to turn community ideas into working Gno applications.',
    body: 'Fund a small team to ship a working prototype, improve developer onboarding and share what they learn. The sprint is open to community feedback, with a public demo at the end of each milestone.',
    milestones: ['Working prototype & public demo', 'Documentation & final delivery'],
    recipient: 'Builder team · demo wallet',
    comments: [
      {
        id: 'c1',
        author: 'wallet-demo-jules',
        body: 'The milestone split makes sense. Can the first demo include the full onboarding journey?',
        date: '2026-11-23T10:30:00Z'
      },
      {
        id: 'c2',
        author: 'wallet-demo-anika',
        body: 'Yes — the first milestone includes a usable end-to-end flow. I added that to revision 3.',
        date: '2026-11-23T11:12:00Z'
      }
    ]
  },
  {
    id: 11,
    title: 'Support community documentation',
    status: 'Voting',
    topic: 'Community',
    amount: 8000,
    author: 'wallet-demo-ember',
    duration: '6 weeks',
    revision: 2,
    summary: 'Make the path from first visit to first contribution easier to follow.',
    body: 'Create concise tutorials, refresh examples and translate the most-used onboarding pages. Contributors will publish progress weekly and make all material available to the community.',
    milestones: ['Publish starter guides', 'Community review & translations'],
    recipient: 'Documentation team · demo wallet',
    comments: []
  },
  {
    id: 10,
    title: 'A monthly Gno builders meetup',
    status: 'Discussion',
    topic: 'Community',
    amount: 2400,
    author: 'wallet-demo-leo',
    duration: '3 months',
    revision: 1,
    summary: 'A regular place for builders to share progress and find collaborators.',
    body: 'Run three online sessions with short demos, a contributor introduction and open questions. The request covers preparation, recordings and community notes.',
    milestones: ['First two meetups', 'Third meetup & recap'],
    recipient: 'Community team · demo wallet',
    comments: []
  },
  {
    id: 9,
    title: 'Improve the community toolbox',
    status: 'Approved',
    topic: 'Development',
    amount: 9000,
    author: 'wallet-demo-noor',
    duration: '4 weeks',
    revision: 2,
    summary: 'Small improvements that make everyday community work easier.',
    body: 'Improve navigation, accessibility and the quality of shared developer resources. This approved example has an outstanding treasury commitment; payment is a separate step.',
    milestones: ['Accessibility review', 'Release & documentation'],
    recipient: 'Toolbox team · demo wallet',
    comments: []
  },
  {
    id: 8,
    title: 'Community infrastructure',
    status: 'Approved',
    topic: 'Operations',
    amount: 6000,
    author: 'wallet-demo-jules',
    duration: '3 months',
    revision: 1,
    summary: 'Keep shared community services available and documented.',
    body: 'Maintain community services for three months, with a public monthly report. This approved example is committed but has not yet been paid.',
    milestones: ['Service setup', 'Quarterly service report'],
    recipient: 'Operations team · demo wallet',
    comments: []
  },
  {
    id: 7,
    title: 'Launch the contributor handbook',
    status: 'Completed',
    topic: 'Community',
    amount: 1500,
    author: 'wallet-demo-ember',
    duration: '2 weeks',
    revision: 1,
    summary: 'A clear first step for new contributors.',
    body: 'The example handbook was delivered, reviewed and paid. Its payment is already reflected in the opening balance shown in this demo.',
    milestones: ['Handbook delivery', 'Community review'],
    recipient: 'Documentation team · demo wallet',
    comments: []
  }
];
export function initialState() {
  return {
    version: 1,
    connected: false,
    profile: {
      name: '',
      bio: '',
      telegram: '',
      discord: '',
      telegramProof: false,
      discordProof: false,
      expires: null
    },
    proposals: structuredClone(proposalFixtures),
    votes: {},
    drafts: {},
    registration: null,
    paid: [],
    activities: []
  };
}
export function loadState(storage) {
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY));
    if (
      saved?.version !== 1 ||
      !Array.isArray(saved.proposals) ||
      !saved.profile ||
      !Array.isArray(saved.paid)
    )
      return initialState();
    return { ...initialState(), ...saved };
  } catch {
    return initialState();
  }
}
export function normalizeName(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\.gno$/, '');
}
export function quoteName(value, years = 1) {
  const name = normalizeName(value);
  if (!/^[a-z][a-z0-9]{0,62}$/.test(name))
    return { valid: false, reason: 'Use 1–63 letters or digits, starting with a letter.' };
  if (![1, 2, 3].includes(Number(years)))
    return { valid: false, reason: 'Choose 1, 2 or 3 years.' };
  const multiplier = { 1: 100, 2: 25, 3: 5, 4: 2 }[name.length] || 1;
  const amount = 31.536 * multiplier * Number(years);
  return { valid: true, name, amount, usd: amount * 0.05, years: Number(years) };
}
export function availableName(value, current = '') {
  const name = normalizeName(value);
  return (
    name === current ||
    !['gno', 'gnoland', 'cosmoot', 'admin', ...examplePeople.map((p) => p.name)].includes(name)
  );
}
export function budgetFor(state, proposal = null) {
  const paid = state.proposals.filter((p) => state.paid.includes(p.id));
  const balance = 60000 - paid.reduce((sum, p) => sum + p.amount, 0);
  const committed = state.proposals
    .filter((p) => p.status === 'Approved' && !state.paid.includes(p.id))
    .reduce((sum, p) => sum + p.amount, 0);
  const proposed =
    proposal && ['Draft', 'Discussion', 'Voting', 'Ready'].includes(proposal.status)
      ? proposal.amount
      : 0;
  return {
    balance,
    committed,
    proposed,
    reserve: 1000,
    available: balance - committed - 1000,
    remaining: balance - committed - proposed - 1000
  };
}
export function payProposal(state, id) {
  const p = state.proposals.find((item) => item.id === id);
  if (!p || p.status !== 'Approved' || state.paid.includes(id)) return false;
  const b = budgetFor(state);
  if (p.amount > b.balance - b.reserve) return false;
  state.paid.push(id);
  p.status = 'Completed';
  return true;
}
export function connectSocial(profile, platform, value) {
  if (!['telegram', 'discord'].includes(platform)) return false;
  const handle = value.trim().replace(/^@/, '');
  const valid =
    platform === 'telegram'
      ? /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(handle)
      : /^[a-zA-Z0-9_.]{2,32}$/.test(handle);
  if (!valid) return false;
  profile[platform] = handle;
  profile[`${platform}Proof`] = false;
  return true;
}
