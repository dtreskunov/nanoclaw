// Horizontally scrollable group strip with subtitles.
import './GroupPicker.css';
import { groups, groupId, isElevatedUser, nowTick } from '../state';
import { selectGroup } from '../actions';
import { fmtRelative, fmtAbsolute } from '../utils';

export function GroupStrip() {
  const elevated = isElevatedUser.value;
  // Non-elevated users only see groups they belong to.
  const visible = elevated
    ? groups.value
    : groups.value.filter((g) => g.hasContent !== false);

  // Subscribe to tick so relative times refresh.
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  nowTick.value;

  const pick = (gid: string): void => {
    if (gid !== groupId.value) selectGroup(gid).catch(console.error);
  };

  return (
    <nav class="group-strip" role="tablist" aria-label="Agent groups">
      {visible.map((g) => {
        const active = g.id === groupId.value;
        const isAdminOnly = elevated && g.hasContent === false;
        // Build subtitle parts.
        const parts: string[] = [];
        if (!g.isAdmin) parts.push('\uD83D\uDD12');
        if (isAdminOnly) parts.push('\uD83D\uDC41');
        if (g.lastActivityAt) parts.push(fmtRelative(g.lastActivityAt));
        const subtitle = parts.join(' \u00B7 ');
        return (
          <button
            type="button"
            key={g.id}
            role="tab"
            aria-selected={active}
            class={`group-chip${active ? ' active' : ''}${isAdminOnly ? ' admin-only' : ''}`}
            title={isAdminOnly
              ? `Visible to you as admin${g.lastActivityAt ? ' \u00B7 ' + fmtAbsolute(g.lastActivityAt) : ''}`
              : g.lastActivityAt ? fmtAbsolute(g.lastActivityAt) : ''}
            onClick={() => pick(g.id)}
          >
            <span class="chip-name">{g.name}</span>
            {subtitle ? <span class="chip-sub">{subtitle}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}
