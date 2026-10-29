# Shared platform features

## 1. Sign in and session

**Flow**
1. Open the public app.
2. Enter a username and password from `TEST_CREDENTIALS.md`.
3. Select **Sign in**.
4. The app loads the role dashboard and keeps the session in an HTTP-only cookie.
5. Select **Sign out** in the sidebar to end the session.

**UI verification**
1. Submit an invalid login and confirm the UI does not enter the workspace.
2. Sign in with a valid account and confirm the identity and role in the top bar.
3. Refresh; confirm the session and current business remain valid.
4. Sign out; confirm **Sign in to your workspace** appears.
5. Use Back or revisit a protected URL; confirm protected content is not exposed.

## 2. Business and tenant scope

**Flow**
- Tenant users are locked to their assigned business.
- `manager.multi` can switch between Harbor Café and Garden Table.
- `superadmin` can use **All businesses** or choose Harbor, Garden, or North.
- Changing business reloads the tenant-scoped product state.

**UI verification**
1. Sign in as `admin.harbor`; confirm **Business** only lists Harbor Café.
2. Sign in as `manager.multi`; confirm exactly Harbor Café and Garden Table, then switch and confirm tenant-specific menu names change.
3. Sign in as `superadmin`; confirm **All businesses** plus all three tenants.
4. On **All businesses**, verify aggregate portfolio information; choose one business and confirm only its catalog markers remain.
5. Confirm no foreign tenant marker appears for a single-tenant account.

## 3. Role navigation and authorization

**Flow**
1. The sidebar is generated from the authenticated role.
2. Selecting a link opens the corresponding workspace.
3. Direct links are checked by a capability guard.

**UI verification**
1. Compare visible navigation with the role map in `README.md`.
2. As cashier, manager, kitchen, or display, directly open `/admin/menu`.
3. Confirm **Access unavailable** and the explanation that the account lacks the capability.
4. Confirm the forbidden admin UI never renders behind the message.

## 4. Responsive navigation

1. Resize to about 390 × 844.
2. Select **Open navigation**; confirm the sidebar opens and focus enters it.
3. Select a route; confirm the sidebar closes.
4. Reopen it, press Escape, and confirm it closes.
5. Confirm **Sign out** remains reachable and there is no page-level horizontal overflow.

## 5. Messages

**Flow**
1. Select **Messages (N unread)** in the top bar.
2. Review sender, text, and time in the dialog.
3. Where permitted, mark a message read; unread count updates and persists.
4. Cashiers can follow **Show all messages** to the cashier dashboard.
5. Close with **Close messages**, Escape, or the backdrop.

**UI verification**
- Confirm focus moves into the dialog and returns to the trigger on close.
- Mark one message read, close/reopen, and verify it stays read.
- Confirm tenant-specific messages do not leak across business selection.

## 6. Theme, accessibility, and state simulation

1. Select **Switch to light theme** / **Switch to dark theme**; refresh and confirm persistence.
2. Use keyboard-only navigation: verify visible focus and logical order.
3. Use **Skip to main content** and confirm focus reaches the main region.
4. In **Demo state**, test **Loading**, **Empty**, and **Error**; verify skeleton, empty explanation, and error/retry UI respectively.
5. Return to **Ready** and confirm normal content.
6. Verify availability and order states include words/symbols, not color alone.
7. Check common widths 320, 375, 414, 768, and 1024 px for reachable controls and no page overflow.
