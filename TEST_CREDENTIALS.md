# Development test credentials

These fictional accounts are enabled when `NODE_ENV` is not `production`. Passwords can be overridden with the matching variables in `.env`; normal startup creates missing accounts but never changes an existing password.

| Scope | Role | Username | Development password |
| --- | --- | --- | --- |
| Global | Admin | `admin` | `light-pos-admin` |
| Harbor | Cashier | `cashier.harbor` | `light-pos-cashier.harbor` |
| Harbor | Manager | `manager.harbor` | `light-pos-manager.harbor` |
| Harbor | Kitchen | `kitchen.harbor` | `light-pos-kitchen.harbor` |
| Harbor | Display | `display.harbor` | `light-pos-display.harbor` |
| Garden | Cashier | `cashier.garden` | `light-pos-cashier.garden` |
| Garden | Manager | `manager.garden` | `light-pos-manager.garden` |
| Garden | Kitchen | `kitchen.garden` | `light-pos-kitchen.garden` |
| Garden | Display | `display.garden` | `light-pos-display.garden` |
| North | Cashier | `cashier.north` | `light-pos-cashier.north` |
| North | Manager | `manager.north` | `light-pos-manager.north` |
| North | Kitchen | `kitchen.north` | `light-pos-kitchen.north` |
| North | Display | `display.north` | `light-pos-display.north` |
| Harbor + Garden | Manager | `manager.multi` | `light-pos-manager.multi` |

Production refuses to create any missing account unless its corresponding `POS_*_PASSWORD` is present and at least 12 characters. Passwords, salts, and hashes are never returned by the API or rendered in the UI.
