# Secure Admin Dashboard Implementation Plan

This plan details the implementation of the Secure Admin Dashboard with Steam OAuth integration.

## Task 1: Steam OpenID 2.0 Authentication Flow
- **Context:** We need to allow users to log in via Steam to identify their SteamID64.
- **Requirements:**
  1. Update `DashboardServer` in `src/ts/addons/dashboard/server.ts` to include `/auth/login` and `/api/auth/callback` routes.
  2. `/auth/login`: Redirect the user to Steam OpenID endpoint.
  3. `/api/auth/callback`: Validate the login with Steam and extract the `claimed_id` (SteamID64).
  4. Generate a random `sessionToken`, store it in a `Map<string, string>` (token -> steamId64), and set it as an `HttpOnly` cookie.
- **Review Criteria:** Navigating to `/auth/login` redirects to Steam, and successful login returns the user to the dashboard with a session cookie.

## Task 2: Admin Authorization & Session Verification
- **Context:** Only users with 'z' (root) flag in MetaBun's admin system should access management features.
- **Requirements:**
  1. Implement a `validateSession(req)` helper in `DashboardServer`.
  2. Integrate with `this.adminManager.GetAdminFlags(steamId)` to check for the 'z' flag.
  3. Ensure the WebSocket connection (`/ws`) also validates the session cookie before allowing administrative events or commands.
- **Review Criteria:** API calls without a valid 'z' flag session return 403 Forbidden.

## Task 3: Administrative API Endpoints
- **Context:** Provide the backend logic for server management.
- **Requirements:**
  1. Implement `POST /api/admin/kick` (body: `{ userId: number }`). Calls `this.pluginManager.KickClient`.
  2. Implement `POST /api/admin/map` (body: `{ mapName: string }`). Calls `this.pluginManager.ServerCommand`.
  3. Implement `POST /api/admin/plugins/reload` (body: `{ pluginName: string }`). Calls `this.pluginManager.ReloadPlugin`.
  4. Ensure all actions are logged using `this.pluginManager.LogMessage`.
- **Review Criteria:** POST requests to these endpoints trigger the corresponding server actions.

## Task 4: Dynamic UI & Management Panels
- **Context:** Update the frontend to show management controls to authorized users.
- **Requirements:**
  1. Update `src/ts/addons/dashboard/public/index.html`.
  2. Add a "Login with Steam" button for guest users.
  3. If an admin session is detected, show a "Management" sidebar or extra buttons in the player table.
  4. Implement `fetch` calls for Kick, Map change, and Plugin reload.
  5. Add a "Logout" button that clears the session.
- **Review Criteria:** Clean, functional UI that reveals management features only after a successful admin login.
