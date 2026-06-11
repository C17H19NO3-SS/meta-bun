# MetaBun Secure Admin Dashboard Design

## Overview
This design document defines the architecture for a secure, management-capable web dashboard for MetaBun. It leverages Steam OAuth (OpenID 2.0) for authentication and cross-references MetaBun's internal admin flag system for authorization.

## 1. Authentication Flow (Steam OpenID 2.0)
The dashboard server will handle the OpenID 2.0 authentication lifecycle without external dependencies where possible.

- **Login Endpoint (`/auth/login`):** Redirects the user to the official Steam Community login portal with a dynamically generated `return_to` URL based on the request's `Host` header.
- **Callback Endpoint (`/api/auth/callback`):** Validates the returned claim from Steam by performing a server-side verify request. Upon success, the user's **SteamID64** is extracted.
- **Session Management:** A cryptographically secure random session token is generated and stored in a server-side memory map linked to the SteamID64. This token is delivered to the browser via a secure cookie.

## 2. Authorization & Admin Manager Integration
Authentication proves *who* the user is; Authorization determines *what* they can do.

- **Flag Check:** Every administrative request triggers a lookup in MetaBun's `AdminManager`. The system verifies if the authenticated SteamID possesses the **'z' (Root)** flag.
- **Audit Logging:** All actions performed via the web dashboard are logged to the central `admin.log` file, identifying the user by their SteamID.

## 3. Administrative API Endpoints
New secure endpoints will be exposed under the `/api/admin/` prefix:
- **`POST /api/admin/kick`:** Triggers a server-side kick for a target `userId`.
- **`POST /api/admin/map`:** Executes a map change command.
- **`POST /api/admin/plugins/reload`:** Triggers a dynamic hot-reload of a specific plugin.
- **`GET /api/admin/status`:** Returns extended server stats only visible to admins.

## 4. UI/UX Enhancements (Admin Mode)
The dashboard interface will dynamically adapt based on the user's authentication state.
- **Public View:** Shows basic uptime, server name, and player list (no actions).
- **Admin View:** 
  - Adds "Kick" and "Ban" action buttons to the player table.
  - Adds a "Map Management" section with a dropdown of known maps.
  - Adds a "Plugin Control" tab to manage MetaBun addons in real-time.

## 5. Security Constraints
- **CORS & Host Binding:** The server listens on `0.0.0.0` but strictly validates callback origins.
- **Port Isolation:** Maintains the dedicated dashboard port (3000) separate from game traffic.
- **Credential Protection:** Steam API keys are loaded from `settings.json` and never exposed to the frontend.
