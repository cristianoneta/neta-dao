//! Opt-in DAO mailboxes. UNI-7 only, no deployed instance is inferred.
//! Queries and ciphertext are public. Confidentiality comes from independently
//! encrypted per-device envelopes, never from hiding a query or a UI element.
use super::*;
use std::collections::BTreeSet;

const ADMIN: Item<Addr> = Item::new("dao_registrar");
const REGISTRY: Item<Addr> = Item::new("dao_nns_registry");
const DAOS: Map<&str, Dao> = Map::new("dao_identities");
const RECORDS: Map<(&str, u64), Record> = Map::new("dao_records");
const THREADS: Map<(&str, &Addr), Thread> = Map::new("dao_threads");
const BLOCKS: Map<(&str, &Addr), bool> = Map::new("dao_blocks");
const SESSIONS: Map<(&str, &Addr, &Addr), (u64, u64)> = Map::new("dao_sessions");
const MAX_READERS: usize = 32;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Dao {
    pub name: String,
    pub authority: Addr,
    pub group: Addr,
    pub enabled: bool,
    pub revision: u64,
    pub readers: Readers,
    pub managers: Vec<Addr>,
}
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Readers {
    Selected(Vec<Addr>),
    AllMembers,
}
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Delivery {
    pub recipient: Addr,
    pub generation: u64,
    pub fingerprint: String,
    pub prekey_id: Option<u16>,
    pub ciphertext: Binary,
}
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Record {
    pub sequence: u64,
    pub message_id: String,
    pub name: String,
    pub policy_revision: u64,
    pub correspondent: Addr,
    pub author: Addr,
    pub author_generation: u64,
    pub reply: bool,
    pub deliveries: Vec<Delivery>,
    pub timestamp: u64,
    pub height: u64,
}
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    Open,
    Assigned,
    Answered,
}
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Thread {
    pub revision: u64,
    pub status: Status,
    pub assignee: Option<Addr>,
    pub last_sequence: u64,
}
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Execute {
    /// Set once on a NEW deployment; no admin switch can weaken sender identity.
    BindRegistry { address: String },
    /// Curated, immutable name + authority + membership-source assignment.
    RegisterDao {
        name: String,
        authority: String,
        group: String,
    },
    /// Only the DAO authority itself may opt in/change its policy.
    Configure {
        name: String,
        expected_revision: u64,
        enabled: bool,
        readers: Readers,
        managers: Vec<String>,
    },
    SetBlock {
        name: String,
        address: String,
        blocked: bool,
        expected_revision: u64,
    },
    Assign {
        name: String,
        correspondent: String,
        expected_revision: u64,
        take: bool,
    },
    Send {
        name: String,
        expected_revision: u64,
        sender_generation: u64,
        message_id: String,
        reply_to: Option<String>,
        expected_thread_revision: Option<u64>,
        deliveries: Vec<Delivery>,
    },
}
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Query {
    Registry {},
    Identity {
        name: String,
    },
    /// Cursor is the last SCANNED identity, even if no accessible items result.
    Mailboxes {
        address: String,
        after: Option<String>,
        limit: Option<u32>,
    },
    Recipients {
        name: String,
    },
    Inbox {
        name: String,
        after: Option<u64>,
        limit: Option<u32>,
    },
    Thread {
        name: String,
        correspondent: String,
    },
    Blocked {
        name: String,
        address: String,
    },
}
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct MailboxPage {
    pub items: Vec<Dao>,
    pub next: Option<String>,
}
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Recipient {
    pub address: Addr,
    pub device: Device,
}
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Roster {
    pub name: String,
    pub revision: u64,
    pub recipients: Vec<Recipient>,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum GroupQuery {
    Member {
        addr: String,
        at_height: Option<u64>,
    },
    ListMembers {
        start_after: Option<String>,
        limit: u32,
    },
}
#[derive(Deserialize)]
struct Member {
    addr: String,
    weight: u64,
}
#[derive(Deserialize)]
struct MemberResult {
    weight: Option<u64>,
}
#[derive(Deserialize)]
struct MembersResult {
    members: Vec<Member>,
}
#[derive(Serialize)]
#[serde(rename_all = "snake_case")]
enum NameQuery {
    NameOf { address: String },
    Identity { name: String },
}
#[derive(Deserialize)]
struct NameOf {
    address: String,
    name: Option<String>,
}
#[derive(Deserialize)]
struct NameIdentity {
    name: String,
    owner: String,
    expires_at: u64,
}

fn fail(message: &str) -> Error {
    StdError::generic_err(message).into()
}
fn next(value: u64) -> Result<u64, Error> {
    value.checked_add(1).ok_or(Error::Sequence)
}
pub fn init(storage: &mut dyn cosmwasm_std::Storage, owner: &Addr) -> StdResult<()> {
    ADMIN.save(storage, owner)
}
pub fn active_name(deps: Deps, env: &Env, address: &Addr, required: bool) -> Result<(), Error> {
    let Some(registry) = REGISTRY.may_load(deps.storage)? else {
        return if required {
            Err(fail("NNS registry is not bound"))
        } else {
            Ok(())
        };
    };
    let result: NameOf = deps.querier.query_wasm_smart(
        &registry,
        &NameQuery::NameOf {
            address: address.to_string(),
        },
    )?;
    let name = result
        .name
        .ok_or_else(|| fail("active .neta sender identity required"))?;
    if result.address != address.as_str() {
        return Err(fail("NNS address mismatch"));
    }
    let identity: NameIdentity = deps
        .querier
        .query_wasm_smart(registry, &NameQuery::Identity { name: name.clone() })?;
    if identity.name != name
        || identity.owner != address.as_str()
        || identity.expires_at <= env.block.time.seconds()
    {
        return Err(fail("NNS ownership changed or expired"));
    }
    Ok(())
}
fn canonical(name: &str) -> bool {
    let Some(label) = name.strip_suffix(".dao.neta") else {
        return false;
    };
    (3..=48).contains(&label.len())
        && !label.starts_with('-')
        && !label.ends_with('-')
        && !label.contains("--")
        && label
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}
fn member(deps: Deps, dao: &Dao, who: &Addr) -> StdResult<bool> {
    let result: MemberResult = deps.querier.query_wasm_smart(
        &dao.group,
        &GroupQuery::Member {
            addr: who.to_string(),
            at_height: None,
        },
    )?;
    Ok(result.weight.unwrap_or(0) > 0)
}
fn addresses(deps: Deps, values: &[Addr]) -> Result<(), Error> {
    if values.len() > MAX_READERS {
        return Err(fail("reader capacity exceeded"));
    }
    let mut seen = BTreeSet::new();
    for value in values {
        if deps.api.addr_validate(value.as_str())? != *value || !seen.insert(value) {
            return Err(fail("invalid or duplicate reader"));
        }
    }
    Ok(())
}
/// Reads current CW4 state on EVERY send/permission query, not a saved snapshot.
pub fn readers(deps: Deps, dao: &Dao) -> StdResult<Vec<Addr>> {
    let candidates = match &dao.readers {
        Readers::Selected(list) => list.clone(),
        Readers::AllMembers => {
            let mut list = Vec::new();
            let mut after = None;
            let mut scanned = 0;
            loop {
                let page: MembersResult = deps.querier.query_wasm_smart(
                    &dao.group,
                    &GroupQuery::ListMembers {
                        start_after: after.clone(),
                        limit: 20,
                    },
                )?;
                if page.members.is_empty() {
                    break;
                }
                scanned += page.members.len();
                if scanned > MAX_READERS {
                    return Err(StdError::generic_err(
                        "DAO exceeds all-members capacity; select readers",
                    ));
                }
                for item in &page.members {
                    if after.as_ref().is_some_and(|old| item.addr <= *old) {
                        return Err(StdError::generic_err("invalid membership pagination"));
                    }
                    after = Some(item.addr.clone());
                    if item.weight > 0 {
                        list.push(deps.api.addr_validate(&item.addr)?);
                    }
                    if list.len() > MAX_READERS {
                        return Err(StdError::generic_err(
                            "DAO exceeds all-members capacity; select readers",
                        ));
                    }
                }
                // Reject huge/zero-weight groups as well; no unbounded gas loop.
                if page.members.len() > 20 || (page.members.len() == 20 && list.len() < 20) {
                    return Err(StdError::generic_err("unsupported membership page"));
                }
                if page.members.len() < 20 {
                    break;
                }
            }
            list
        }
    };
    let mut result = Vec::new();
    for address in candidates {
        if member(deps, dao, &address)? {
            result.push(address);
        }
    }
    result.sort();
    result.dedup();
    Ok(result)
}
fn roster(deps: Deps, dao: &Dao) -> StdResult<Roster> {
    if !dao.enabled {
        return Err(StdError::generic_err("DAO inbox disabled"));
    }
    let mut recipients = Vec::new();
    for address in readers(deps, dao)? {
        let device = DEVICES.load(deps.storage, &address)?;
        if !device.active {
            return Err(StdError::generic_err("reader device is not active"));
        }
        recipients.push(Recipient { address, device });
    }
    if recipients.is_empty() {
        return Err(StdError::generic_err("no current readers"));
    }
    Ok(Roster {
        name: dao.name.clone(),
        revision: dao.revision,
        recipients,
    })
}
fn manager(deps: Deps, dao: &Dao, actor: &Addr) -> StdResult<bool> {
    Ok(actor == dao.authority
        || (dao.enabled && dao.managers.contains(actor) && readers(deps, dao)?.contains(actor)))
}
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: Execute,
) -> Result<Response, Error> {
    match msg {
        Execute::BindRegistry { address } => {
            if info.sender != ADMIN.load(deps.storage)? || REGISTRY.exists(deps.storage) {
                return Err(fail("registry binding not authorized"));
            }
            let address = deps.api.addr_validate(&address)?;
            let _: NameOf = deps.querier.query_wasm_smart(
                &address,
                &NameQuery::NameOf {
                    address: info.sender.to_string(),
                },
            )?;
            REGISTRY.save(deps.storage, &address)?;
            Ok(Response::new().add_attribute("action", "bind_nns_registry"))
        }
        Execute::RegisterDao {
            name,
            authority,
            group,
        } => {
            if info.sender != ADMIN.load(deps.storage)?
                || !canonical(&name)
                || DAOS.has(deps.storage, &name)
            {
                return Err(fail("DAO assignment not authorized or name unavailable"));
            }
            let dao = Dao {
                name: name.clone(),
                authority: deps.api.addr_validate(&authority)?,
                group: deps.api.addr_validate(&group)?,
                enabled: false,
                revision: 1,
                readers: Readers::Selected(vec![]),
                managers: vec![],
            };
            // Source is curated by registrar; verify CW4 query compatibility.
            member(deps.as_ref(), &dao, &dao.authority)?;
            DAOS.save(deps.storage, &name, &dao)?;
            Ok(Response::new()
                .add_attribute("action", "register_dao_identity")
                .add_attribute("name", name))
        }
        Execute::Configure {
            name,
            expected_revision,
            enabled,
            readers: selection,
            managers,
        } => {
            let mut dao = DAOS.load(deps.storage, &name)?;
            if info.sender != dao.authority || dao.revision != expected_revision {
                return Err(fail("DAO authority or revision mismatch"));
            }
            if let Readers::Selected(ref list) = selection {
                addresses(deps.as_ref(), list)?;
            }
            let managers = managers
                .iter()
                .map(|v| deps.api.addr_validate(v))
                .collect::<StdResult<Vec<_>>>()?;
            addresses(deps.as_ref(), &managers)?;
            dao.readers = selection;
            dao.managers = managers;
            dao.enabled = enabled;
            if enabled {
                REGISTRY.load(deps.storage)?;
                let current = self::readers(deps.as_ref(), &dao)?;
                if current.is_empty() || dao.managers.iter().any(|a| !current.contains(a)) {
                    return Err(fail("readers/managers must be current members"));
                }
                if let Readers::Selected(ref list) = dao.readers {
                    if list.len() != current.len() {
                        return Err(fail("selected reader is not a current member"));
                    }
                }
            }
            dao.revision = next(dao.revision)?;
            DAOS.save(deps.storage, &name, &dao)?;
            Ok(Response::new()
                .add_attribute("action", "configure_dao_inbox")
                .add_attribute("revision", dao.revision.to_string()))
        }
        Execute::SetBlock {
            name,
            address,
            blocked,
            expected_revision,
        } => {
            let mut dao = DAOS.load(deps.storage, &name)?;
            if dao.revision != expected_revision || !manager(deps.as_ref(), &dao, &info.sender)? {
                return Err(fail("inbox manager or revision mismatch"));
            }
            let address = deps.api.addr_validate(&address)?;
            if blocked {
                BLOCKS.save(deps.storage, (&name, &address), &true)?;
            } else {
                BLOCKS.remove(deps.storage, (&name, &address));
            }
            // Invalidate pending preparations, including block/unblock races.
            dao.revision = next(dao.revision)?;
            DAOS.save(deps.storage, &name, &dao)?;
            Ok(Response::new().add_attribute("action", "block_dao_sender"))
        }
        Execute::Assign {
            name,
            correspondent,
            expected_revision,
            take,
        } => {
            let dao = DAOS.load(deps.storage, &name)?;
            if !dao.enabled || !readers(deps.as_ref(), &dao)?.contains(&info.sender) {
                return Err(fail("current inbox reader required"));
            }
            let correspondent = deps.api.addr_validate(&correspondent)?;
            let mut thread = THREADS.load(deps.storage, (&name, &correspondent))?;
            if thread.revision != expected_revision {
                return Err(fail("thread changed"));
            }
            if thread.assignee.as_ref().is_some_and(|a| a != info.sender)
                && !manager(deps.as_ref(), &dao, &info.sender)?
            {
                return Err(fail("conversation already assigned"));
            }
            thread.assignee = if take { Some(info.sender) } else { None };
            thread.status = if take { Status::Assigned } else { Status::Open };
            thread.revision = next(thread.revision)?;
            THREADS.save(deps.storage, (&name, &correspondent), &thread)?;
            Ok(Response::new().add_attribute("action", "assign_dao_conversation"))
        }
        Execute::Send {
            name,
            expected_revision,
            sender_generation,
            message_id,
            reply_to,
            expected_thread_revision,
            deliveries,
        } => send(
            deps,
            env,
            info,
            name,
            expected_revision,
            sender_generation,
            message_id,
            reply_to,
            expected_thread_revision,
            deliveries,
        ),
    }
}

#[allow(clippy::too_many_arguments)]
fn send(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    name: String,
    expected_revision: u64,
    sender_generation: u64,
    message_id: String,
    reply_to: Option<String>,
    expected_thread_revision: Option<u64>,
    deliveries: Vec<Delivery>,
) -> Result<Response, Error> {
    let dao = DAOS.load(deps.storage, &name)?;
    if !dao.enabled || dao.revision != expected_revision {
        return Err(fail("DAO inbox disabled or changed"));
    }
    active_name(deps.as_ref(), &env, &info.sender, true)?;
    let author = DEVICES.load(deps.storage, &info.sender)?;
    if !author.active || author.generation != sender_generation {
        return Err(Error::DeviceChanged);
    }
    if !hex_id(&message_id, 64) {
        return Err(Error::Message);
    }
    if SENT_IDS.has(deps.storage, (&info.sender, &message_id)) {
        return Err(Error::Duplicate);
    }
    let current = readers(deps.as_ref(), &dao)?;
    let reply = reply_to.is_some();
    let correspondent = if let Some(address) = reply_to {
        if !current.contains(&info.sender) {
            return Err(fail("current inbox reader required"));
        }
        let address = deps.api.addr_validate(&address)?;
        let thread = THREADS.load(deps.storage, (&name, &address))?;
        if expected_thread_revision != Some(thread.revision) {
            return Err(fail("conversation changed before reply"));
        }
        if thread.assignee.as_ref().is_some_and(|a| a != info.sender)
            && !manager(deps.as_ref(), &dao, &info.sender)?
        {
            return Err(fail("conversation assigned to another reader"));
        }
        active_name(deps.as_ref(), &env, &address, true)?;
        address
    } else {
        info.sender.clone()
    };
    if BLOCKS.has(deps.storage, (&name, &correspondent)) {
        return Err(Error::Blocked);
    }
    let mut expected: BTreeSet<Addr> = current.iter().cloned().collect();
    if reply {
        expected.insert(correspondent.clone());
    }
    expected.remove(&info.sender); // Sender retains its own authenticated local archive.
    if expected.is_empty()
        || deliveries.len() != expected.len()
        || deliveries.len() > MAX_READERS + 1
    {
        return Err(fail("recipient set changed"));
    }
    let mut updates = Vec::new();
    for delivery in &deliveries {
        if !expected.remove(&delivery.recipient) {
            return Err(fail("unexpected or duplicate recipient"));
        }
        if !(16..=MAX_CIPHERTEXT).contains(&delivery.ciphertext.len()) {
            return Err(Error::Message);
        }
        let mut device = DEVICES.load(deps.storage, &delivery.recipient)?;
        if !device.active
            || device.generation != delivery.generation
            || device.fingerprint != delivery.fingerprint
        {
            return Err(Error::DeviceChanged);
        }
        if reply
            && delivery.recipient == correspondent
            && BLOCKED.has(deps.storage, (&correspondent, &dao.authority))
        {
            return Err(Error::Blocked);
        }
        let pair = (device.generation, author.generation);
        let established = SESSIONS
            .may_load(deps.storage, (&name, &delivery.recipient, &info.sender))?
            == Some(pair);
        if let Some(id) = delivery.prekey_id {
            if established {
                return Err(Error::InitialUsed);
            }
            let index = device
                .prekeys
                .iter()
                .position(|p| p.id == id)
                .ok_or(Error::PrekeySpent)?;
            device.prekeys.remove(index);
        } else if !established {
            return Err(fail("DAO session requires an initial message"));
        }
        updates.push((delivery.recipient.clone(), device, pair));
    }
    if let Some(last) = LAST_SEND.may_load(deps.storage, &info.sender)? {
        if env.block.time.seconds() < last.saturating_add(SEND_COOLDOWN_SECONDS) {
            return Err(Error::Cooldown);
        }
    }
    let sequence = next(NEXT_SEQUENCE.load(deps.storage)?)?;
    let old = THREADS.may_load(deps.storage, (&name, &correspondent))?;
    let assignee = if reply {
        Some(info.sender.clone())
    } else {
        old.as_ref()
            .and_then(|t| t.assignee.clone())
            .filter(|a| current.contains(a))
    };
    let thread = Thread {
        revision: next(old.map_or(0, |v| v.revision))?,
        status: if reply {
            Status::Answered
        } else if assignee.is_some() {
            Status::Assigned
        } else {
            Status::Open
        },
        assignee,
        last_sequence: sequence,
    };
    let record = Record {
        sequence,
        message_id: message_id.clone(),
        name: name.clone(),
        policy_revision: dao.revision,
        correspondent: correspondent.clone(),
        author: info.sender.clone(),
        author_generation: author.generation,
        reply,
        deliveries,
        timestamp: env.block.time.seconds(),
        height: env.block.height,
    };
    // Validate all recipients BEFORE writes; chain transaction is atomic.
    for (recipient, device, pair) in updates {
        DEVICES.save(deps.storage, &recipient, &device)?;
        SESSIONS.save(deps.storage, (&name, &recipient, &info.sender), &pair)?;
        SESSIONS.save(
            deps.storage,
            (&name, &info.sender, &recipient),
            &(pair.1, pair.0),
        )?;
    }
    RECORDS.save(deps.storage, (&name, sequence), &record)?;
    THREADS.save(deps.storage, (&name, &correspondent), &thread)?;
    SENT_IDS.save(deps.storage, (&info.sender, &message_id), &sequence)?;
    NEXT_SEQUENCE.save(deps.storage, &sequence)?;
    LAST_SEND.save(deps.storage, &info.sender, &env.block.time.seconds())?;
    Ok(Response::new()
        .add_attribute("action", "send_dao_message")
        .add_attribute("sequence", sequence.to_string()))
}
pub fn query(deps: Deps, msg: Query) -> StdResult<Binary> {
    match msg {
        Query::Registry {} => to_json_binary(&REGISTRY.may_load(deps.storage)?),
        Query::Identity { name } => to_json_binary(&DAOS.may_load(deps.storage, &name)?),
        Query::Mailboxes {
            address,
            after,
            limit,
        } => {
            let address = deps.api.addr_validate(&address)?;
            let limit = limit.unwrap_or(20).clamp(1, 50) as usize;
            let scan = DAOS
                .range(
                    deps.storage,
                    after.as_deref().map(Bound::exclusive),
                    None,
                    Order::Ascending,
                )
                .take(limit + 1)
                .collect::<StdResult<Vec<_>>>()?;
            let next = if scan.len() > limit {
                Some(scan[limit - 1].0.clone())
            } else {
                None
            };
            let mut items = Vec::new();
            for (_, dao) in scan.into_iter().take(limit) {
                if dao.enabled && readers(deps, &dao)?.contains(&address) {
                    items.push(dao);
                }
            }
            to_json_binary(&MailboxPage { items, next })
        }
        Query::Recipients { name } => {
            to_json_binary(&roster(deps, &DAOS.load(deps.storage, &name)?)?)
        }
        Query::Inbox { name, after, limit } => {
            let messages = RECORDS
                .prefix(&name)
                .range(
                    deps.storage,
                    after.map(Bound::exclusive),
                    None,
                    Order::Ascending,
                )
                .take(limit.unwrap_or(20).clamp(1, 50) as usize)
                .map(|row| row.map(|(_, v)| v))
                .collect::<StdResult<Vec<_>>>()?;
            to_json_binary(&messages)
        }
        Query::Thread {
            name,
            correspondent,
        } => to_json_binary(&THREADS.may_load(
            deps.storage,
            (&name, &deps.api.addr_validate(&correspondent)?),
        )?),
        Query::Blocked { name, address } => {
            to_json_binary(&BLOCKS.has(deps.storage, (&name, &deps.api.addr_validate(&address)?)))
        }
    }
}

#[cfg(test)]
mod tests;
