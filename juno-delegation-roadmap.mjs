// Display-only roadmap. These examples never enter the V1 policy or simulation.
export const objectiveCriteria = [
  [
    'Public RPC / API',
    30,
    'Operator-attributed endpoints; independently measured availability, freshness and latency. Aliases earn no extra points.'
  ],
  [
    'Mainnet uptime',
    10,
    'Expected signatures during active participation, with monitoring gaps visible.'
  ],
  [
    'Upgrade responsiveness',
    10,
    'Points for independently evidenced participation within an approved observation window.'
  ],
  [
    'Testnet participation',
    10,
    'Active UNI-7 membership at the snapshot; active .neta name and verified operator linkage for this bonus only.'
  ],
  [
    'Governance participation',
    10,
    'Own votes on completed proposals, with every vote option treated equally and a fair historical denominator.'
  ],
  [
    'Archive services',
    10,
    'Attributed archive access and historical coverage, measured independently.'
  ],
  [
    'Geographic diversity',
    10,
    'Evidence of country concentration; inferred location is not an exact or verified physical location.'
  ],
  [
    'Hosting diversity',
    10,
    'Evidence of provider concentration and independent infrastructure. Unknown attribution stays unassessed.'
  ]
];
export const subjectiveCriteria = [
  'Ecosystem development',
  'Community contributions',
  'Other documented contributions'
];
const node = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
};
function weight(label, value, id) {
  const wrap = node('label', label, 'future-weight');
  const input = node('input');
  input.id = id;
  input.type = 'number';
  input.min = '0';
  input.max = '100';
  input.disabled = true;
  if (value !== null) input.value = String(value);
  else input.placeholder = 'Not set';
  wrap.append(input);
  return wrap;
}
// Preview only. Keeping C complementary also keeps the displayed total at 100%.
const objectiveShare = 80;
const subjectiveShare = 100 - objectiveShare;
function categoryWeight(label, value, id) {
  const wrap = node('label', undefined, 'category-weight');
  wrap.append(node('span', label));
  const control = node('span', undefined, 'category-weight-control');
  const input = node('input');
  input.id = id;
  input.type = 'number';
  input.min = '0';
  input.max = '100';
  input.step = '1';
  input.value = String(value);
  input.disabled = true;
  const suffix = node('span', '%');
  suffix.setAttribute('aria-hidden', 'true');
  control.append(input, suffix);
  wrap.append(control);
  return wrap;
}
function disclosure(id, label, hint) {
  const details = node('details', undefined, 'policy-details');
  details.id = id;
  const summary = node('summary', label);
  summary.append(node('span', hint));
  details.append(summary);
  return details;
}
export function renderFuturePolicy(host, prefix) {
  const mix = node('div', undefined, 'scoring-mix');
  mix.append(
    node('strong', `V3 weighting preview · B ${objectiveShare}% + C ${subjectiveShare}% = 100%`)
  );
  mix.append(
    node(
      'p',
      'Percentage inputs unlock when both categories are available. B + C must always total 100%. V2 uses objective scoring only (B = 100%).'
    )
  );
  mix.id = `${prefix}-weighting-help`;
  const objective = node('section', undefined, 'planner-card future-policy');
  objective.setAttribute('aria-labelledby', `${prefix}-objective-title`);
  const heading = node('div', undefined, 'policy-heading');
  const title = node('h3', 'B · Objective scoring');
  title.id = `${prefix}-objective-title`;
  heading.append(title, node('span', 'V2 · Planned', 'state-pill neutral'));
  const header = node('div', undefined, 'category-header');
  const copy = node('div');
  copy.append(heading, node('p', 'Measured contributions earn points after eligibility checks.'));
  const ow = categoryWeight('Objective weight · %', objectiveShare, `${prefix}-objective-share`);
  ow.querySelector('input').setAttribute('aria-describedby', mix.id);
  header.append(copy, ow);
  objective.append(header);
  const od = disclosure(
    `${prefix}-objective-details`,
    'Objective criteria & weights',
    '8 criteria · planned'
  );
  const settings = node('fieldset');
  settings.disabled = true;
  settings.append(node('legend', 'Within-category weighting example · inactive'));
  const rows = node('div', undefined, 'future-criteria');
  for (const [index, [name, value]] of objectiveCriteria.entries()) {
    const row = node('div', undefined, 'future-criterion');
    row.append(
      node('h4', name),
      weight('Within objective · %', value, `${prefix}-objective-${index}`)
    );
    rows.append(row);
  }
  settings.append(rows);
  od.append(settings);
  od.append(
    node(
      'p',
      'Example: 80% objective × 30% RPC = 24% of the total score. The other seven criteria each contribute 8%. Within-group weights total 100%.',
      'weight-explanation'
    )
  );
  const measurements = node('div', undefined, 'future-measurements');
  measurements.append(node('h4', 'How these future criteria would be measured'));
  for (const [name, , help] of objectiveCriteria) {
    const item = node('p');
    item.append(node('strong', name + ': '), node('span', help));
    measurements.append(item);
  }
  od.append(
    measurements,
    node(
      'p',
      'Proposed observation windows: 30 days for uptime and infrastructure; 20 completed proposals for governance. Missing evidence is unassessed, not a zero score. Measurement methods, thresholds and weights require community approval.',
      'field-help'
    )
  );
  objective.append(od);
  const subjective = node('section', undefined, 'planner-card future-policy');
  const sh = node('div', undefined, 'policy-heading');
  const st = node('h3', 'C · Subjective assessment');
  st.id = `${prefix}-subjective-title`;
  subjective.setAttribute('aria-labelledby', st.id);
  sh.append(st, node('span', 'V3 · Planned', 'state-pill neutral'));
  const sc = node('div');
  sc.append(
    sh,
    node('p', 'An appointed external DAO or person assesses documented contributions.')
  );
  const sch = node('div', undefined, 'category-header');
  const sw = categoryWeight('Subjective weight · %', subjectiveShare, `${prefix}-subjective-share`);
  sw.querySelector('input').setAttribute('aria-describedby', mix.id);
  sch.append(sc, sw);
  subjective.append(sch);
  const sd = disclosure(
    `${prefix}-subjective-details`,
    'Subjective criteria & assessor',
    '3 criteria · planned'
  );
  const sf = node('fieldset');
  sf.disabled = true;
  sf.append(node('legend', 'Future assessment settings · inactive'));
  const reviewer = node('div', undefined, 'assessor-settings');
  const typeLabel = node('label', 'Assessor type');
  const type = node('select');
  type.disabled = true;
  type.append(
    node('option', 'Not appointed'),
    node('option', 'External DAO'),
    node('option', 'Person')
  );
  typeLabel.append(type);
  const addressLabel = node('label', 'Assessor address or DAO');
  const address = node('input');
  address.disabled = true;
  address.placeholder = 'Chosen in an approved V3 rule';
  addressLabel.append(address);
  reviewer.append(typeLabel, addressLabel);
  sf.append(reviewer);
  for (const [index, name] of subjectiveCriteria.entries()) {
    const row = node('div', undefined, 'future-criterion');
    row.append(
      node('h4', name),
      weight('Within subjective · %', null, `${prefix}-subjective-${index}`)
    );
    sf.append(row);
  }
  sd.append(
    sf,
    node(
      'p',
      'Illustrative categories; no assessor, subjective weights or scores are set. Each future criterion and group weight will be configurable. Group weights must total 100%, and each group’s criterion weights must total 100%.',
      'field-help'
    )
  );
  sd.append(
    node(
      'p',
      'The appointed assessor supplies scores and reasons, not permission to move funds. Changes to criteria, weights or assessor require a new community-approved rule version.',
      'field-help'
    )
  );
  subjective.append(sd);
  host.replaceChildren(mix, objective, subjective);
}
