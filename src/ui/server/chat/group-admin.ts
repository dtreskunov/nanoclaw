/**
 * Per-group admin API mounted under /ui/chat/api/groups/:gid/admin/*.
 *
 * Access gate: authenticated chat session + `hasAdminPrivilege(userId, gid)`
 * — covers owner, global admin, and scoped admin of the group.
 *
 * Mutations call DB helpers directly (no approval routing). This matches the
 * CLI host path; the CLI's `access: 'approval'` tag exists to gate agent-
 * initiated calls (see src/cli/dispatch.ts), not host operators. Every
 * mutation funnels through `recordAdminAction()` so Phase 2 can swap the
 * audit seam for a real DB table without touching handlers.
 */
import http from 'http';
import { URL } from 'url';

import { CONTAINER_IMAGE } from '../../../config.js';
import { readEnvFile } from '../../../env.js';
import { buildAgentGroupImage } from '../../../container-runner.js';
import { restartAgentGroupContainers } from '../../../container-restart.js';
import { getDb } from '../../../db/connection.js';
import { getAgentGroup, updateAgentGroup } from '../../../db/agent-groups.js';
import { getContainerConfig, updateContainerConfigScalars } from '../../../db/container-configs.js';
import { log } from '../../../log.js';
import {
  addMember,
  getMembers,
  hasMembershipRow,
  removeMember,
} from '../../../modules/permissions/db/agent-group-members.js';
import { getIdentitiesForUser } from '../../../modules/permissions/db/identities.js';
import { getAllUsers, getUser } from '../../../modules/permissions/db/users.js';
import {
  getAdminsOfAgentGroup,
  grantRole,
  hasAdminPrivilege,
  isAdminOfAgentGroup,
  isGlobalAdmin,
  isOwner,
} from '../../../modules/permissions/db/user-roles.js';
import type { ContainerConfigRow } from '../../../types.js';
import { authenticate } from '../auth.js';
import { SELECTABLE_AGENT_PROVIDERS, VALID_AGENT_PROVIDERS } from './agent-providers.js';
import { recordAdminAction } from './audit.js';
import { listImages } from './image-catalog.js';
import { bareIdForResponse, dbValueFromBareId, getModelDetails, listModelsForProvider } from './models-catalog.js';
import { deriveVoiceMode } from './voice-mode.js';

// ── allowed scalar config fields (mirrors ncl groups config update) ───────

const SCALAR_FIELDS = [
  'provider',
  'model',
  'effort',
  'image_tag',
  'assistant_name',
  'max_messages_per_prompt',
  'cli_scope',
  'transcription_model',
] as const;

// Provider list is parsed once at startup from the agent-runner's
// registration barrel (container/agent-runner/src/providers/index.ts) so the
// admin UI and server validation stay in sync with whatever providers the
// runtime actually loads — see ./agent-providers.ts. `mock` is accepted
// server-side (existing groups may have it set via the CLI) but is excluded
// from the picker the client shows.
const VALID_PROVIDERS = VALID_AGENT_PROVIDERS;
const SELECTABLE_PROVIDERS = SELECTABLE_AGENT_PROVIDERS;
const VALID_CLI_SCOPES = ['disabled', 'group', 'global'] as const;
const VALID_VOICE_MODES = ['off', 'transcribe', 'audio'] as const;

// ── dispatcher ────────────────────────────────────────────────────────────

interface MatchedRoute {
  method: string;
  gid: string;
  rest: string;
}

function matchRoute(method: string, pathname: string): MatchedRoute | null {
  // /api/groups/:gid/admin/<rest>
  const m = /^\/api\/groups\/([^/]+)\/admin(\/.*)?$/.exec(pathname);
  if (!m) return null;
  return {
    method,
    gid: decodeURIComponent(m[1]!),
    rest: m[2] || '/',
  };
}

/**
 * Try to handle a chat-admin request. Returns true if the URL matched a
 * group-admin route (response was written), false otherwise so the caller
 * can fall through to the next dispatcher.
 */
export async function handleGroupAdminRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
): Promise<boolean> {
  const route = matchRoute(req.method || 'GET', pathname);
  if (!route) return false;

  const session = authenticate(req);
  if (!session) {
    writeJson(res, 401, { error: 'unauthorized' });
    return true;
  }

  // Existence + access gate together: a group the user can't admin should
  // return 403 whether or not it exists (don't leak existence).
  const group = getAgentGroup(route.gid);
  if (!group || !hasAdminPrivilege(session.userId, route.gid)) {
    writeJson(res, 403, { error: 'forbidden' });
    return true;
  }

  try {
    await dispatch(req, res, session.userId, route, group.id);
  } catch (err) {
    if (err instanceof BadRequest) {
      writeJson(res, 400, { error: err.message });
      return true;
    }
    log.error('group-admin handler threw', { gid: route.gid, rest: route.rest, err });
    writeJson(res, 500, { error: 'internal_error' });
  }
  return true;
}

class BadRequest extends Error {}

async function dispatch(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  actorUserId: string,
  route: MatchedRoute,
  gid: string,
): Promise<void> {
  const { method, rest } = route;

  if (rest === '/settings' && method === 'GET') return handleGetSettings(res, gid, actorUserId);
  if (rest === '/settings' && method === 'PATCH') return handlePatchSettings(req, res, actorUserId, gid);
  if (rest === '/restart' && method === 'POST') return handleRestart(req, res, actorUserId, gid);

  if (rest === '/members' && method === 'GET') return handleGetMembers(res, gid);
  if (rest === '/members' && method === 'POST') return handleAddMember(req, res, actorUserId, gid);
  {
    const m = /^\/members\/([^/]+)$/.exec(rest);
    if (m && method === 'DELETE') return handleRemoveMember(res, actorUserId, gid, decodeURIComponent(m[1]!));
  }

  if (rest === '/roles' && method === 'GET') return handleGetRoles(res, gid);
  if (rest === '/roles' && method === 'POST') return handleGrantRole(req, res, actorUserId, gid);
  {
    const m = /^\/roles\/([^/]+)$/.exec(rest);
    if (m && method === 'DELETE') return handleRevokeRole(res, actorUserId, gid, decodeURIComponent(m[1]!));
  }

  if (rest === '/users-search' && method === 'GET') return handleUsersSearch(req, res);

  if (rest === '/models' && method === 'GET') return handleListModels(req, res);
  if (rest === '/images' && method === 'GET') return handleListImages(res);

  writeJson(res, 404, { error: 'not_found' });
}

// ── settings ──────────────────────────────────────────────────────────────

interface SettingsResponse {
  id: string;
  name: string;
  folder: string;
  createdAt: string;
  updatedAt: string | null;
  config: Pick<
    ContainerConfigRow,
    | 'provider'
    | 'model'
    | 'effort'
    | 'image_tag'
    | 'assistant_name'
    | 'max_messages_per_prompt'
    | 'cli_scope'
    | 'voice_mode'
    | 'transcription_model'
  >;
  /** Resolved defaults for nullable config fields (shown as placeholders). */
  defaults: {
    provider: string | null;
    model: string | null;
    image_tag: string | null;
  };
  validProviders: readonly string[];
  validCliScopes: readonly string[];
  validVoiceModes: readonly string[];
  runningSessionCount: number;
  /** Tooltip / detail / age for the currently-selected model and image. */
  selectedModelDetail: { label: string; detail?: string; tooltip?: string } | null;
  selectedImageDetail: { label: string; createdAt: string | null; size: number | null } | null;
  /** True iff the acting admin is owner or global admin (controls UI gating
   * of privilege-escalating options like cli_scope=global). */
  actorIsElevated: boolean;
}

async function handleGetSettings(res: http.ServerResponse, gid: string, actorUserId: string): Promise<void> {
  const group = getAgentGroup(gid)!; // already validated by caller
  const cfg = getContainerConfig(gid);
  if (!cfg) {
    writeJson(res, 500, { error: 'container_config_missing' });
    return;
  }
  const running = getDb()
    .prepare("SELECT COUNT(*) AS n FROM sessions WHERE agent_group_id = ? AND status = 'active'")
    .get(gid) as { n: number };

  // Translate DB model value → bare id for the wire. Client never sees the
  // OPENCODE_PROVIDER prefix.
  const bareModelId = bareIdForResponse(cfg.provider, cfg.model);

  let selectedModelDetail: SettingsResponse['selectedModelDetail'] = null;
  if (cfg.provider && bareModelId) {
    const m = await getModelDetails(cfg.provider, bareModelId);
    if (m) selectedModelDetail = { label: m.label, detail: m.detail, tooltip: m.tooltip };
  }

  let selectedImageDetail: SettingsResponse['selectedImageDetail'] = null;
  if (cfg.image_tag) {
    const match = listImages().find((i) => i.value === cfg.image_tag);
    if (match) {
      selectedImageDetail = { label: match.label, createdAt: match.createdAt, size: match.size };
    }
  }

  // Resolve effective defaults for fields the UI shows as placeholders.
  const envDefaults = readEnvFile(['DEFAULT_PROVIDER', 'DEFAULT_MODEL']);
  const defaultProvider = envDefaults.DEFAULT_PROVIDER || 'claude';
  const defaultModel = envDefaults.DEFAULT_MODEL || null;
  const defaultImage = CONTAINER_IMAGE || null;

  const body: SettingsResponse = {
    id: group.id,
    name: group.name,
    folder: group.folder,
    createdAt: group.created_at,
    updatedAt: cfg.updated_at ?? null,
    config: {
      provider: cfg.provider,
      model: bareModelId,
      effort: cfg.effort,
      image_tag: cfg.image_tag,
      assistant_name: cfg.assistant_name,
      max_messages_per_prompt: cfg.max_messages_per_prompt,
      cli_scope: cfg.cli_scope,
      voice_mode: cfg.voice_mode,
      transcription_model: cfg.transcription_model,
    },
    defaults: {
      provider: defaultProvider,
      model: defaultModel ? bareIdForResponse(defaultProvider, defaultModel) : null,
      image_tag: defaultImage,
    },
    validProviders: SELECTABLE_PROVIDERS,
    validCliScopes: VALID_CLI_SCOPES,
    validVoiceModes: VALID_VOICE_MODES,
    runningSessionCount: running.n,
    selectedModelDetail,
    selectedImageDetail,
    actorIsElevated: isOwner(actorUserId) || isGlobalAdmin(actorUserId),
  };
  writeJson(res, 200, body);
}

async function handlePatchSettings(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  actorUserId: string,
  gid: string,
): Promise<void> {
  const body = (await readJsonBody(req)) as Record<string, unknown>;
  // Distinguish "key absent" (skip) from "key present with null/empty"
  // (clear to null). The DB columns for provider/model/effort/image_tag/
  // assistant_name/max_messages_per_prompt/cli_scope all allow NULL.
  const updates: Partial<
    Pick<
      ContainerConfigRow,
      | 'provider'
      | 'model'
      | 'effort'
      | 'image_tag'
      | 'assistant_name'
      | 'max_messages_per_prompt'
      | 'cli_scope'
      | 'voice_mode'
      | 'transcription_model'
    >
  > = {};
  const isElevated = isOwner(actorUserId) || isGlobalAdmin(actorUserId);

  // Group name lives in agent_groups, not container_configs.
  let nameUpdate: string | undefined;
  if ('name' in body) {
    const raw = body['name'];
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) throw new BadRequest('name cannot be empty');
    if (trimmed.length > 100) throw new BadRequest('name must be 100 characters or fewer');
    nameUpdate = trimmed;
  }

  for (const key of SCALAR_FIELDS) {
    if (!(key in body)) continue;
    const raw = body[key];
    const isCleared = raw == null || raw === '';
    if (key === 'provider') {
      if (isCleared) {
        updates.provider = null;
        continue;
      }
      const v = String(raw);
      if (!VALID_PROVIDERS.includes(v)) {
        throw new BadRequest(`provider must be one of: ${VALID_PROVIDERS.join(', ')}`);
      }
      updates.provider = v;
    } else if (key === 'cli_scope') {
      if (isCleared) {
        // cli_scope is NOT NULL in container_configs (TEXT DEFAULT 'group')
        // — disallow clearing it.
        throw new BadRequest('cli_scope cannot be empty; pick one of: ' + VALID_CLI_SCOPES.join(', '));
      }
      const v = String(raw);
      if (!VALID_CLI_SCOPES.includes(v as (typeof VALID_CLI_SCOPES)[number])) {
        throw new BadRequest(`cli_scope must be one of: ${VALID_CLI_SCOPES.join(', ')}`);
      }
      // Setting cli_scope=global grants the agent unrestricted `ncl` access
      // — system-wide control. Reserve to owner / global admin so a scoped
      // admin can't escalate via their own group's agent.
      if (v === 'global' && !isElevated) {
        throw new BadRequest('only owner or global admin may set cli_scope to "global"');
      }
      updates.cli_scope = v;
    } else if (key === 'max_messages_per_prompt') {
      if (isCleared) {
        updates.max_messages_per_prompt = null;
        continue;
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 1 || n > 1000) {
        throw new BadRequest('max_messages_per_prompt must be a number between 1 and 1000');
      }
      updates.max_messages_per_prompt = Math.floor(n);
    } else {
      // model, effort, image_tag, assistant_name — nullable strings
      updates[key] = isCleared ? null : String(raw);
    }
  }

  // Translate the bare model id back to the DB wire value once provider is
  // known. If provider is also being patched, use the new value so the
  // prefix matches the user's intent.
  if ('model' in updates) {
    const existing = getContainerConfig(gid);
    const effectiveProvider = updates.provider ?? existing?.provider ?? null;
    updates.model = dbValueFromBareId(effectiveProvider, updates.model ?? null);
    const bareModel = bareIdForResponse(effectiveProvider, updates.model ?? null);
    if (effectiveProvider && bareModel) {
      const exact = await getModelDetails(effectiveProvider, bareModel);
      if (!exact) {
        const catalog = await listModelsForProvider(effectiveProvider);
        const q = bareModel.trim().toLowerCase();
        const partialMatch = catalog.models.some(
          (m) => m.id.toLowerCase().includes(q) || m.label.toLowerCase().includes(q),
        );
        if (partialMatch) {
          throw new BadRequest('model must be selected from the catalog, not a partial search term');
        }
      }
    }
  }

  if ('transcription_model' in updates || 'provider' in updates || 'model' in updates) {
    const existing = getContainerConfig(gid);
    const envDefaults = readEnvFile(['DEFAULT_PROVIDER', 'DEFAULT_MODEL']);
    const effectiveProvider = updates.provider ?? existing?.provider ?? envDefaults.DEFAULT_PROVIDER ?? 'claude';
    const effectiveModel =
      'model' in updates
        ? updates.model
        : (existing?.model ??
          (envDefaults.DEFAULT_MODEL ? dbValueFromBareId(effectiveProvider, envDefaults.DEFAULT_MODEL) : null));
    const effectiveTranscriptionModel =
      'transcription_model' in updates
        ? (updates.transcription_model ?? null)
        : (existing?.transcription_model ?? null);
    updates.voice_mode = await deriveVoiceMode(effectiveProvider, effectiveModel ?? null, effectiveTranscriptionModel);
  }

  if (Object.keys(updates).length === 0 && nameUpdate === undefined) {
    throw new BadRequest('no editable fields supplied');
  }

  if (nameUpdate !== undefined) {
    updateAgentGroup(gid, { name: nameUpdate });
  }
  if (Object.keys(updates).length > 0) {
    updateContainerConfigScalars(gid, updates);
  }
  recordAdminAction({
    actorUserId,
    action: 'group_config_update',
    targetKind: 'agent_group',
    targetId: gid,
    payload: { ...(nameUpdate !== undefined ? { name: nameUpdate } : {}), ...updates } as Record<string, unknown>,
  });
  await handleGetSettings(res, gid, actorUserId);
}

async function handleRestart(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  actorUserId: string,
  gid: string,
): Promise<void> {
  const body = (await readJsonBody(req)) as { rebuild?: unknown; message?: unknown };
  const rebuild = body.rebuild === true;
  const message = typeof body.message === 'string' && body.message.length > 0 ? body.message : undefined;

  if (rebuild) {
    await buildAgentGroupImage(gid);
  }
  const count = restartAgentGroupContainers(gid, 'restarted via chat-ui admin', message);
  recordAdminAction({
    actorUserId,
    action: 'group_restart',
    targetKind: 'agent_group',
    targetId: gid,
    payload: { rebuild, restarted: count },
  });
  writeJson(res, 200, { restarted: count, rebuilt: rebuild });
}

// ── members ───────────────────────────────────────────────────────────────

interface MemberDto {
  userId: string;
  displayName: string | null;
  primaryHandle: string | null;
  primaryChannel: string | null;
  isExplicitMember: boolean;
  isAdmin: boolean;
}

function userDtoBase(userId: string): {
  displayName: string | null;
  primaryChannel: string | null;
  primaryHandle: string | null;
} {
  const user = getUser(userId);
  const identities = getIdentitiesForUser(userId);
  const primary = identities.find((i) => i.primary_for_channel === 1) ?? identities[0] ?? null;
  return {
    displayName: user?.display_name?.trim() || null,
    primaryChannel: primary?.channel ?? null,
    primaryHandle: primary?.handle ?? null,
  };
}

function handleGetMembers(res: http.ServerResponse, gid: string): void {
  const rows = getMembers(gid);
  const seen = new Set<string>();
  const out: MemberDto[] = [];
  for (const r of rows) {
    if (seen.has(r.user_id)) continue;
    seen.add(r.user_id);
    const base = userDtoBase(r.user_id);
    out.push({
      userId: r.user_id,
      ...base,
      isExplicitMember: true,
      isAdmin: isAdminOfAgentGroup(r.user_id, gid),
    });
  }
  // Surface admins of the group even without an explicit membership row —
  // they're implicit members per the permissions module.
  for (const a of getAdminsOfAgentGroup(gid)) {
    if (seen.has(a.user_id)) continue;
    seen.add(a.user_id);
    const base = userDtoBase(a.user_id);
    out.push({
      userId: a.user_id,
      ...base,
      isExplicitMember: false,
      isAdmin: true,
    });
  }
  writeJson(res, 200, { members: out });
}

async function handleAddMember(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  actorUserId: string,
  gid: string,
): Promise<void> {
  const body = (await readJsonBody(req)) as { userId?: unknown };
  const userId = typeof body.userId === 'string' ? body.userId : '';
  if (!userId) throw new BadRequest('userId is required');
  if (!getUser(userId)) throw new BadRequest('user not found');
  if (isAdminOfAgentGroup(userId, gid)) {
    throw new BadRequest('user is an admin of this group — already an implicit member');
  }
  addMember({ user_id: userId, agent_group_id: gid, added_by: actorUserId, added_at: new Date().toISOString() });
  recordAdminAction({
    actorUserId,
    action: 'group_member_add',
    targetKind: 'agent_group',
    targetId: gid,
    payload: { userId },
  });
  writeJson(res, 200, { ok: true });
}

function handleRemoveMember(res: http.ServerResponse, actorUserId: string, gid: string, userId: string): void {
  if (isAdminOfAgentGroup(userId, gid)) {
    writeJson(res, 400, { error: 'user is an admin of this group — revoke the admin role first' });
    return;
  }
  if (!hasMembershipRow(userId, gid)) {
    writeJson(res, 404, { error: 'membership not found' });
    return;
  }
  removeMember(userId, gid);
  recordAdminAction({
    actorUserId,
    action: 'group_member_remove',
    targetKind: 'agent_group',
    targetId: gid,
    payload: { userId },
  });
  writeJson(res, 200, { ok: true });
}

// ── scoped roles (admin grants on THIS group only) ────────────────────────

interface RoleDto {
  userId: string;
  displayName: string | null;
  primaryHandle: string | null;
  primaryChannel: string | null;
  grantedAt: string;
  grantedBy: string | null;
}

function handleGetRoles(res: http.ServerResponse, gid: string): void {
  const rows = getAdminsOfAgentGroup(gid);
  const out: RoleDto[] = rows.map((r) => ({
    userId: r.user_id,
    ...userDtoBase(r.user_id),
    grantedAt: r.granted_at,
    grantedBy: r.granted_by,
  }));
  writeJson(res, 200, { admins: out });
}

async function handleGrantRole(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  actorUserId: string,
  gid: string,
): Promise<void> {
  const body = (await readJsonBody(req)) as { userId?: unknown };
  const userId = typeof body.userId === 'string' ? body.userId : '';
  if (!userId) throw new BadRequest('userId is required');
  if (!getUser(userId)) throw new BadRequest('user not found');
  if (isAdminOfAgentGroup(userId, gid)) {
    writeJson(res, 200, { ok: true, alreadyGranted: true });
    return;
  }
  grantRole({
    user_id: userId,
    role: 'admin',
    agent_group_id: gid,
    granted_by: actorUserId,
    granted_at: new Date().toISOString(),
  });
  recordAdminAction({
    actorUserId,
    action: 'group_role_grant',
    targetKind: 'agent_group',
    targetId: gid,
    payload: { userId, role: 'admin' },
  });
  writeJson(res, 200, { ok: true });
}

function handleRevokeRole(res: http.ServerResponse, actorUserId: string, gid: string, userId: string): void {
  if (!isAdminOfAgentGroup(userId, gid)) {
    writeJson(res, 404, { error: 'role not found' });
    return;
  }
  // Use the same SQL the permissions module exposes; one statement, scoped.
  getDb()
    .prepare('DELETE FROM user_roles WHERE user_id = ? AND role = ? AND agent_group_id = ?')
    .run(userId, 'admin', gid);
  recordAdminAction({
    actorUserId,
    action: 'group_role_revoke',
    targetKind: 'agent_group',
    targetId: gid,
    payload: { userId, role: 'admin' },
  });
  writeJson(res, 200, { ok: true });
}

// ── user search (for the add-member / grant-role picker) ──────────────────

interface UserSearchDto {
  userId: string;
  displayName: string | null;
  kind: string;
  primaryHandle: string | null;
  primaryChannel: string | null;
}

function handleUsersSearch(req: http.IncomingMessage, res: http.ServerResponse): void {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const qRaw = (url.searchParams.get('q') || '').trim().toLowerCase();
  const limit = 50;
  const users = getAllUsers();
  const matches: UserSearchDto[] = [];
  for (const u of users) {
    const base = userDtoBase(u.id);
    if (qRaw) {
      const haystacks = [
        u.id.toLowerCase(),
        (base.displayName || '').toLowerCase(),
        (base.primaryHandle || '').toLowerCase(),
      ];
      if (!haystacks.some((h) => h.includes(qRaw))) continue;
    }
    matches.push({
      userId: u.id,
      displayName: base.displayName,
      kind: u.kind,
      primaryHandle: base.primaryHandle,
      primaryChannel: base.primaryChannel,
    });
    if (matches.length >= limit) break;
  }
  writeJson(res, 200, { users: matches });
}

// ── model catalog (for the model dropdown) ────────────────────────────────

async function handleListModels(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const provider = (url.searchParams.get('provider') || '').trim();
  if (!provider) throw new BadRequest('provider query parameter is required');
  // Allow both agent providers and 'openrouter' (used by the transcription model selector).
  if (!VALID_PROVIDERS.includes(provider) && provider !== 'openrouter') {
    throw new BadRequest(`provider must be one of: ${VALID_PROVIDERS.join(', ')}, openrouter`);
  }
  const inputModality = (url.searchParams.get('inputModality') || '').trim() || undefined;
  const outputModality = (url.searchParams.get('outputModality') || '').trim() || undefined;
  const result = await listModelsForProvider(provider, { inputModality, outputModality });
  writeJson(res, 200, result);
}

// ── image catalog (for the image_tag dropdown) ────────────────────────────

function handleListImages(res: http.ServerResponse): void {
  writeJson(res, 200, { images: listImages() });
}

// ── tiny local helpers (kept private to avoid widening routes.ts surface) ─

function writeJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: http.IncomingMessage, max = 64 * 1024): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const c of req) {
    const buf = c as Buffer;
    total += buf.length;
    if (total > max) throw new BadRequest('body_too_large');
    chunks.push(buf);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new BadRequest('invalid_json');
  }
}
