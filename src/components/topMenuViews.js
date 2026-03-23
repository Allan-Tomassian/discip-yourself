const INLINE_MENU_VIEWS = new Set(["preferences", "wallet", "totem"]);

export function opensInlineMenuView(viewId) {
  return INLINE_MENU_VIEWS.has(viewId);
}
