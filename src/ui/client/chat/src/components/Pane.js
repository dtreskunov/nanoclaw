// Reusable collapsible/drawer pane. Renders the shared <aside class="nc-pane">
// shell with head + toggle, owning all of the open/collapse/drawer state
// logic so individual pane components stay focused on their body content.
//
// Behavior:
//   - Desktop: paneOpen[paneKey] toggles `collapsed` class (CSS handles
//     the rotated handle + width). Click on the head, the chevron button,
//     or anywhere in the collapsed body expands it.
//   - Mobile (max-width:720px): `collapsed` is never applied so the
//     drawer body always renders. drawerOpen[paneKey] toggles `open`
//     (CSS slides the drawer in via transform).
import { html } from '../html.js';
import { paneOpen, drawerOpen, isMobile } from '../state.js';

export function Pane({ paneKey, name, label, extraClass, headActions, children }) {
  const mobile = isMobile.value;
  const collapsed = !mobile && !paneOpen[paneKey].value;
  const drawer = drawerOpen[paneKey].value;
  const cls = 'nc-pane ' + name
    + (collapsed ? ' collapsed' : '')
    + (drawer ? ' open' : '')
    + (extraClass ? ' ' + extraClass : '');
  const toggle = () => { paneOpen[paneKey].value = !paneOpen[paneKey].value; };
  const onPaneClick = (ev) => {
    if (!collapsed) return;
    if (ev.target.closest('button, a')) return;
    paneOpen[paneKey].value = true;
  };
  const onHeadClick = (ev) => {
    if (mobile) return;
    if (ev.target.closest('button, a')) return;
    ev.stopPropagation();
    toggle();
  };
  return html`
    <aside class=${cls} id=${name} onClick=${onPaneClick}>
      <div class="head" onClick=${onHeadClick}>
        <button type="button" class="icon-btn desktop-only" id=${'btn-' + paneKey + '-toggle'}
                aria-label=${collapsed ? 'Expand ' + label : 'Collapse ' + label}
                onClick=${(e) => { e.stopPropagation(); toggle(); }}></button>
        <span class="title">${label}</span>
      </div>
      ${headActions || null}
      ${children}
    </aside>
  `;
}
